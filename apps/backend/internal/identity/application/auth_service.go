// Package application implements the identity use cases.
package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"hash/fnv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
	"github.com/indalyadav56/meetspace/backend/pkg/password"
)

const refreshTokenBytes = 32

var avatarColors = []string{"#4f46e5", "#14b8a6", "#f43f5e", "#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981", "#ec4899"}

type AuthConfig struct {
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	ResetTTL   time.Duration
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	TokenType    string `json:"tokenType"`
	ExpiresIn    int64  `json:"expiresIn"`
}

type AuthService struct {
	users  domain.UserRepository
	tokens domain.RefreshTokenRepository
	resets domain.PasswordResetTokenRepository
	hasher PasswordHasher
	signer TokenSigner
	email  EmailSender
	cfg    AuthConfig
	now    func() time.Time
}

func NewAuthService(users domain.UserRepository, tokens domain.RefreshTokenRepository, resets domain.PasswordResetTokenRepository, hasher PasswordHasher, signer TokenSigner, email EmailSender, cfg AuthConfig) *AuthService {
	return &AuthService{users: users, tokens: tokens, resets: resets, hasher: hasher, signer: signer, email: email, cfg: cfg, now: time.Now}
}

func validatePassword(plain string) error {
	if len(plain) < 8 {
		return apperror.Invalid("weak_password", "password must be at least 8 characters")
	}
	if len(plain) > password.MaxLength {
		return apperror.Invalid("password_too_long", "password must be at most 72 bytes")
	}
	return nil
}

func normalizeEmail(e string) string { return strings.ToLower(strings.TrimSpace(e)) }

func colorFor(email string) string {
	h := fnv.New32a()
	_, _ = h.Write([]byte(email))
	return avatarColors[h.Sum32()%uint32(len(avatarColors))]
}

// Register creates a new active user and returns it with an initial token pair.
func (s *AuthService) Register(ctx context.Context, email, fullName, plain string) (*domain.User, *TokenPair, error) {
	if err := validatePassword(plain); err != nil {
		return nil, nil, err
	}
	email = normalizeEmail(email)
	name := strings.TrimSpace(fullName)
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	hash, err := s.hasher.Hash(plain)
	if err != nil {
		return nil, nil, err
	}
	u := &domain.User{Email: email, FullName: name, Color: colorFor(email), PasswordHash: hash, IsActive: true}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, nil, err
	}
	pair, err := s.issueTokens(ctx, u.ID, uuid.NewString(), nil)
	if err != nil {
		return nil, nil, err
	}
	return u, pair, nil
}

// Login verifies credentials. Unknown email and wrong password are both reported as ErrInvalidCredentials.
func (s *AuthService) Login(ctx context.Context, email, plain string) (*domain.User, *TokenPair, error) {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, domain.ErrUserNotFound) {
		return nil, nil, domain.ErrInvalidCredentials
	}
	if err != nil {
		return nil, nil, err
	}
	if err := s.hasher.Compare(u.PasswordHash, plain); err != nil {
		return nil, nil, domain.ErrInvalidCredentials
	}
	if !u.IsActive {
		return nil, nil, domain.ErrUserInactive
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

// Refresh rotates a refresh token. Presenting an already-revoked token is
// treated as theft and revokes the whole session.
func (s *AuthService) Refresh(ctx context.Context, rawToken string) (*TokenPair, error) {
	hash := hashToken(rawToken)
	rt, err := s.tokens.GetByHash(ctx, hash)
	if err != nil {
		return nil, err
	}
	if rt.Revoked {
		_ = s.tokens.RevokeSession(ctx, rt.SessionID)
		return nil, domain.ErrTokenReused
	}
	if s.now().After(rt.ExpiresAt) {
		return nil, domain.ErrTokenExpired
	}
	u, err := s.users.GetByID(ctx, rt.UserID)
	if err != nil {
		return nil, err
	}
	if !u.IsActive {
		return nil, domain.ErrUserInactive
	}
	// Revoke first so a crash after this point fails safe (forces re-login).
	if err := s.tokens.Revoke(ctx, rt.ID); err != nil {
		return nil, err
	}
	return s.issueTokens(ctx, u.ID, rt.SessionID, &hash)
}

func (s *AuthService) Logout(ctx context.Context, sessionID string) error {
	return s.tokens.RevokeSession(ctx, sessionID)
}

// ChangePassword verifies the current password, revokes every session and returns a fresh pair.
func (s *AuthService) ChangePassword(ctx context.Context, userID, current, next string) (*TokenPair, error) {
	if err := validatePassword(next); err != nil {
		return nil, err
	}
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if err := s.hasher.Compare(u.PasswordHash, current); err != nil {
		return nil, domain.ErrInvalidCredentials
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

// ForgotPassword emails a reset token. Unknown emails succeed silently to avoid account enumeration.
func (s *AuthService) ForgotPassword(ctx context.Context, email string) error {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, domain.ErrUserNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	raw, err := randomToken(refreshTokenBytes)
	if err != nil {
		return err
	}
	if err := s.resets.Create(ctx, &domain.PasswordResetToken{UserID: u.ID, TokenHash: hashToken(raw), ExpiresAt: s.now().Add(s.cfg.ResetTTL)}); err != nil {
		return err
	}
	return s.email.SendPasswordReset(ctx, u.Email, raw)
}

func (s *AuthService) ResetPassword(ctx context.Context, rawToken, next string) error {
	if err := validatePassword(next); err != nil {
		return err
	}
	prt, err := s.resets.GetByHash(ctx, hashToken(rawToken))
	if err != nil {
		return err
	}
	if prt.UsedAt != nil {
		return domain.ErrTokenRevoked
	}
	if s.now().After(prt.ExpiresAt) {
		return domain.ErrTokenExpired
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
	access, err := s.signer.GenerateToken(map[string]any{"sub": userID, "sid": sessionID})
	if err != nil {
		return nil, err
	}
	raw, err := randomToken(refreshTokenBytes)
	if err != nil {
		return nil, err
	}
	if err := s.tokens.Create(ctx, &domain.RefreshToken{UserID: userID, SessionID: sessionID, TokenHash: hashToken(raw), Parent: parent, ExpiresAt: s.now().Add(s.cfg.RefreshTTL)}); err != nil {
		return nil, err
	}
	return &TokenPair{AccessToken: access, RefreshToken: raw, TokenType: "Bearer", ExpiresIn: int64(s.cfg.AccessTTL.Seconds())}, nil
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// hashToken stores only a SHA-256 of opaque tokens so a database leak can't be replayed.
func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// inviteTTL is how long a "set your password" link from an invite stays valid.
const inviteTTL = 7 * 24 * time.Hour

// SendInvite emails someone who was just added to a workspace. People invited
// before they had an account get a link to choose their password; everyone
// else gets a link to log in.
func (s *AuthService) SendInvite(ctx context.Context, email, inviterName, workspaceName string) error {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if err != nil {
		return err
	}
	raw := ""
	if strings.HasPrefix(u.PasswordHash, invitedHashPrefix) {
		if raw, err = randomToken(refreshTokenBytes); err != nil {
			return err
		}
		if err := s.resets.Create(ctx, &domain.PasswordResetToken{UserID: u.ID, TokenHash: hashToken(raw), ExpiresAt: s.now().Add(inviteTTL)}); err != nil {
			return err
		}
	}
	return s.email.SendWorkspaceInvite(ctx, u.Email, inviterName, workspaceName, raw)
}
