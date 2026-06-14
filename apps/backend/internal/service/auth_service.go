package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/model"
	"github.com/indalyadav56/meetspace/backend/internal/repository"
	"github.com/indalyadav56/meetspace/backend/pkg/jwt"
	"github.com/indalyadav56/meetspace/backend/pkg/password"
)

const refreshTokenBytes = 32

type AuthConfig struct {
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	ResetTTL   time.Duration
}

type AuthService struct {
	users  repository.UserRepository
	tokens repository.RefreshTokenRepository
	resets repository.PasswordResetTokenRepository
	hasher password.Hasher
	signer *jwt.JWT
	email  EmailSender
	cfg    AuthConfig
	now    func() time.Time
}

func NewAuthService(
	users repository.UserRepository,
	tokens repository.RefreshTokenRepository,
	resets repository.PasswordResetTokenRepository,
	hasher password.Hasher,
	signer *jwt.JWT,
	email EmailSender,
	cfg AuthConfig,
	now func() time.Time,
) *AuthService {
	if now == nil {
		now = time.Now
	}
	return &AuthService{
		users:  users,
		tokens: tokens,
		resets: resets,
		hasher: hasher,
		signer: signer,
		email:  email,
		cfg:    cfg,
		now:    now,
	}
}

// Register creates a new active user and returns it with an initial token pair.
func (s *AuthService) Register(ctx context.Context, email, fullName, plain string) (*model.User, *TokenPair, error) {
	hash, err := s.hasher.Hash(plain)
	if err != nil {
		return nil, nil, err
	}
	u := &model.User{
		Email:        normalizeEmail(email),
		FullName:     strings.TrimSpace(fullName),
		PasswordHash: hash,
		IsActive:     true,
	}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, nil, err // includes model.ErrEmailExists
	}
	pair, err := s.issueTokens(ctx, u.ID, uuid.NewString(), nil)
	if err != nil {
		return nil, nil, err
	}
	return u, pair, nil
}

// Login verifies credentials and returns the user with a fresh token pair.
// Unknown email and wrong password are both reported as ErrInvalidCredentials.
func (s *AuthService) Login(ctx context.Context, email, plain string) (*model.User, *TokenPair, error) {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, model.ErrUserNotFound) {
		return nil, nil, model.ErrInvalidCredentials
	}
	if err != nil {
		return nil, nil, err
	}
	if err := s.hasher.Compare(u.PasswordHash, plain); err != nil {
		return nil, nil, model.ErrInvalidCredentials
	}
	if !u.IsActive {
		return nil, nil, model.ErrUserInactive
	}

	now := s.now()
	if err := s.users.UpdateLastLogin(ctx, u.ID, now); err != nil {
		return nil, nil, err
	}
	u.LastLoginAt = &now

	pair, err := s.issueTokens(ctx, u.ID, uuid.NewString(), nil)
	if err != nil {
		return nil, nil, err
	}
	return u, pair, nil
}

// Refresh rotates a refresh token: it revokes the presented token and issues a
// new pair on the same session. Presenting an already-revoked token is treated
// as theft and revokes the whole session.
func (s *AuthService) Refresh(ctx context.Context, rawToken string) (*TokenPair, error) {
	hash := hashToken(rawToken)
	rt, err := s.tokens.GetByHash(ctx, hash)
	if err != nil {
		return nil, err // includes model.ErrTokenNotFound
	}

	if rt.Revoked {
		// Reuse of a rotated token: revoke the entire session and reject.
		_ = s.tokens.RevokeSession(ctx, rt.SessionID)
		return nil, model.ErrTokenReused
	}
	if s.now().After(rt.ExpiresAt) {
		return nil, model.ErrTokenExpired
	}

	u, err := s.users.GetByID(ctx, rt.UserID)
	if err != nil {
		return nil, err
	}
	if !u.IsActive {
		return nil, model.ErrUserInactive
	}

	// Revoke first so a crash after this point fails safe (forces re-login)
	// rather than leaving two live tokens.
	if err := s.tokens.Revoke(ctx, rt.ID); err != nil {
		return nil, err
	}
	return s.issueTokens(ctx, u.ID, rt.SessionID, &hash)
}

// Logout revokes every refresh token in the given session.
func (s *AuthService) Logout(ctx context.Context, sessionID string) error {
	return s.tokens.RevokeSession(ctx, sessionID)
}

// ChangePassword verifies the current password, sets a new one, revokes all of
// the user's sessions, and returns a fresh pair so the caller stays logged in.
func (s *AuthService) ChangePassword(ctx context.Context, userID, current, next string) (*TokenPair, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.hasher.Compare(u.PasswordHash, current); err != nil {
		return nil, model.ErrInvalidCredentials
	}
	hash, err := s.hasher.Hash(next)
	if err != nil {
		return nil, err
	}
	if err := s.users.UpdatePassword(ctx, userID, hash); err != nil {
		return nil, err
	}
	if err := s.tokens.RevokeAllForUser(ctx, userID); err != nil {
		return nil, err
	}
	return s.issueTokens(ctx, userID, uuid.NewString(), nil)
}

func (s *AuthService) ForgotPassword(ctx context.Context, email string) (string, error) {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, model.ErrUserNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}

	raw, err := randomToken(refreshTokenBytes)
	if err != nil {
		return "", err
	}
	prt := &model.PasswordResetToken{
		UserID:    u.ID,
		TokenHash: hashToken(raw),
		ExpiresAt: s.now().Add(s.cfg.ResetTTL),
	}
	if err := s.resets.Create(ctx, prt); err != nil {
		return "", err
	}
	if err := s.email.SendPasswordReset(ctx, u.Email, raw); err != nil {
		return "", err
	}
	return raw, nil
}

// ResetPassword consumes a reset token, sets the new password, and revokes all
func (s *AuthService) ResetPassword(ctx context.Context, rawToken, next string) error {
	prt, err := s.resets.GetByHash(ctx, hashToken(rawToken))
	if err != nil {
		return err // includes model.ErrTokenNotFound
	}
	if prt.UsedAt != nil {
		return model.ErrTokenRevoked
	}
	if s.now().After(prt.ExpiresAt) {
		return model.ErrTokenExpired
	}

	hash, err := s.hasher.Hash(next)
	if err != nil {
		return err
	}
	if err := s.users.UpdatePassword(ctx, prt.UserID, hash); err != nil {
		return err
	}
	if err := s.resets.MarkUsed(ctx, prt.ID, s.now()); err != nil {
		return err
	}
	return s.tokens.RevokeAllForUser(ctx, prt.UserID)
}

func (s *AuthService) issueTokens(ctx context.Context, userID, sessionID string, parent *string) (*TokenPair, error) {
	access, err := s.signer.GenerateToken(map[string]any{
		"sub": userID,
		"sid": sessionID,
	})
	if err != nil {
		return nil, err
	}

	raw, err := randomToken(refreshTokenBytes)
	if err != nil {
		return nil, err
	}
	rt := &model.RefreshToken{
		UserID:    userID,
		SessionID: sessionID,
		TokenHash: hashToken(raw),
		Parent:    parent,
		ExpiresAt: s.now().Add(s.cfg.RefreshTTL),
	}
	if err := s.tokens.Create(ctx, rt); err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  access,
		RefreshToken: raw,
		TokenType:    "Bearer",
		ExpiresIn:    int64(s.cfg.AccessTTL.Seconds()),
	}, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
