package application

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
	"github.com/indalyadav56/meetspace/backend/pkg/secretbox"
	"github.com/indalyadav56/meetspace/backend/pkg/totp"
)

const (
	mfaTTL        = 5 * time.Minute
	stateTTL      = 10 * time.Minute
	recoveryCount = 10
	totpIssuer    = "Meetspace"
	// ssoHashPrefix marks accounts created through single sign-on: no password can match.
	ssoHashPrefix = "!sso:"
)

// MFARequired is returned by a sign-in that still needs a second factor.
type MFARequired struct{ Token string }

func (e *MFARequired) Error() string { return "two-factor code required" }

// Client is where a request came from; it is recorded on new sessions.
type Client struct{ IP, UserAgent string }

type clientKey struct{}

func WithClient(ctx context.Context, ip, userAgent string) context.Context {
	return context.WithValue(ctx, clientKey{}, Client{IP: ip, UserAgent: userAgent})
}

func clientOf(ctx context.Context) Client {
	c, _ := ctx.Value(clientKey{}).(Client)
	if len(c.UserAgent) > 300 {
		c.UserAgent = c.UserAgent[:300]
	}
	return c
}

// EnableSecurity turns on 2FA and single sign-on. box seals TOTP secrets and
// key signs short-lived sign-in and OAuth state tokens.
func (s *AuthService) EnableSecurity(box *secretbox.Box, key []byte, identities domain.IdentityRepository) {
	s.box, s.key, s.identities = box, key, identities
}

// sign makes an opaque, tamper-proof, expiring token. It is not a JWT, so the
// access-token middleware can never mistake it for a session.
func (s *AuthService) sign(kind, value string, ttl time.Duration) string {
	payload := kind + "\x00" + value + "\x00" + strconv.FormatInt(s.now().Add(ttl).Unix(), 10)
	m := hmac.New(sha256.New, s.key)
	m.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (s *AuthService) verify(kind, token string) (string, error) {
	p, sig, ok := strings.Cut(token, ".")
	payload, err1 := base64.RawURLEncoding.DecodeString(p)
	mac, err2 := base64.RawURLEncoding.DecodeString(sig)
	if !ok || err1 != nil || err2 != nil {
		return "", domain.ErrTokenNotFound
	}
	m := hmac.New(sha256.New, s.key)
	m.Write(payload)
	if !hmac.Equal(mac, m.Sum(nil)) {
		return "", domain.ErrTokenNotFound
	}
	parts := strings.Split(string(payload), "\x00")
	if len(parts) != 3 || parts[0] != kind {
		return "", domain.ErrTokenNotFound
	}
	exp, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || s.now().Unix() > exp {
		return "", domain.ErrMFAExpired
	}
	return parts[1], nil
}

// OAuthState signs the provider and post-login path for an SSO round trip.
func (s *AuthService) OAuthState(provider, redirect, nonce string) string {
	return s.sign("oauth", provider+"\n"+redirect+"\n"+nonce, stateTTL)
}

func (s *AuthService) ParseOAuthState(token string) (provider, redirect, nonce string, err error) {
	v, err := s.verify("oauth", token)
	if err != nil {
		return "", "", "", err
	}
	parts := strings.SplitN(v, "\n", 3)
	if len(parts) != 3 {
		return "", "", "", domain.ErrTokenNotFound
	}
	return parts[0], parts[1], parts[2], nil
}

// finishLogin is the shared tail of every sign-in: second factor, then a session.
func (s *AuthService) finishLogin(ctx context.Context, u *domain.User) (*domain.User, *TokenPair, error) {
	if !u.IsActive {
		return nil, nil, domain.ErrUserInactive
	}
	if u.TOTPEnabled {
		return u, nil, &MFARequired{Token: s.sign("mfa", u.ID, mfaTTL)}
	}
	return s.startSession(ctx, u)
}

func (s *AuthService) startSession(ctx context.Context, u *domain.User) (*domain.User, *TokenPair, error) {
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

// CompleteMFA finishes a sign-in with an authenticator or recovery code.
func (s *AuthService) CompleteMFA(ctx context.Context, mfaToken, code string) (*domain.User, *TokenPair, bool, error) {
	userID, err := s.verify("mfa", mfaToken)
	if err != nil {
		return nil, nil, false, err
	}
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, nil, false, err
	}
	usedRecovery, err := s.checkCode(ctx, u, code)
	if err != nil {
		return u, nil, false, err // the user is returned so the failure can be audited
	}
	u, pair, err := s.startSession(ctx, u)
	return u, pair, usedRecovery, err
}

// checkCode accepts a current TOTP code or an unused recovery code (which is then spent).
func (s *AuthService) checkCode(ctx context.Context, u *domain.User, code string) (usedRecovery bool, err error) {
	if s.box == nil || len(u.TOTPSecret) == 0 {
		return false, domain.ErrTOTPNotSetUp
	}
	secret, err := s.box.Open(u.TOTPSecret)
	if err != nil {
		return false, err
	}
	if totp.Verify(string(secret), code, s.now()) {
		return false, nil
	}
	h := hashToken(normalizeRecovery(code))
	for i, c := range u.TOTPRecovery {
		if hmac.Equal([]byte(c), []byte(h)) {
			rest := append(append([]string{}, u.TOTPRecovery[:i]...), u.TOTPRecovery[i+1:]...)
			if err := s.users.SetTOTP(ctx, u.ID, u.TOTPSecret, u.TOTPEnabled, rest); err != nil {
				return false, err
			}
			u.TOTPRecovery = rest
			return true, nil
		}
	}
	return false, domain.ErrBadCode
}

func normalizeRecovery(code string) string {
	return strings.ToUpper(strings.NewReplacer("-", "", " ", "").Replace(strings.TrimSpace(code)))
}

func newRecoveryCodes() (plain, hashes []string, err error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	for range recoveryCount {
		b := make([]byte, 8)
		if _, err := rand.Read(b); err != nil {
			return nil, nil, err
		}
		for i := range b {
			b[i] = alphabet[int(b[i])%len(alphabet)]
		}
		code := string(b[:4]) + "-" + string(b[4:])
		plain = append(plain, code)
		hashes = append(hashes, hashToken(normalizeRecovery(code)))
	}
	return plain, hashes, nil
}

type TwoFactorStatus struct {
	Enabled      bool `json:"enabled"`
	RecoveryLeft int  `json:"recoveryLeft"`
	HasPassword  bool `json:"hasPassword"`
}

func hasPassword(u *domain.User) bool { return !strings.HasPrefix(u.PasswordHash, "!") }

func (s *AuthService) TwoFactor(ctx context.Context, userID string) (TwoFactorStatus, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return TwoFactorStatus{}, err
	}
	return TwoFactorStatus{Enabled: u.TOTPEnabled, RecoveryLeft: len(u.TOTPRecovery), HasPassword: hasPassword(u)}, nil
}

// SetupTOTP starts enrolment: it stores a new pending secret and returns it
// with the otpauth:// URL for a QR code. Nothing changes until EnableTOTP.
func (s *AuthService) SetupTOTP(ctx context.Context, userID string) (secret, url string, err error) {
	if s.box == nil {
		return "", "", apperror.Unavailable("2fa_unavailable", "two-factor authentication is not configured on this server")
	}
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return "", "", err
	}
	if u.TOTPEnabled {
		return "", "", apperror.Conflict("2fa_enabled", "two-factor authentication is already on; turn it off to set up a new device")
	}
	if secret, err = totp.NewSecret(); err != nil {
		return "", "", err
	}
	sealed, err := s.box.Seal([]byte(secret))
	if err != nil {
		return "", "", err
	}
	if err := s.users.SetTOTP(ctx, userID, sealed, false, nil); err != nil {
		return "", "", err
	}
	return secret, totp.URL(totpIssuer, u.Email, secret), nil
}

// EnableTOTP confirms enrolment with a first code and returns one-time recovery codes.
func (s *AuthService) EnableTOTP(ctx context.Context, userID, code string) ([]string, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.TOTPEnabled {
		return nil, apperror.Conflict("2fa_enabled", "two-factor authentication is already on")
	}
	if len(u.TOTPSecret) == 0 || s.box == nil {
		return nil, domain.ErrTOTPNotSetUp
	}
	secret, err := s.box.Open(u.TOTPSecret)
	if err != nil {
		return nil, err
	}
	if !totp.Verify(string(secret), code, s.now()) {
		return nil, domain.ErrBadCode
	}
	plain, hashes, err := newRecoveryCodes()
	if err != nil {
		return nil, err
	}
	if err := s.users.SetTOTP(ctx, userID, u.TOTPSecret, true, hashes); err != nil {
		return nil, err
	}
	return plain, nil
}

// DisableTOTP turns 2FA off. It needs a current code, and the password too
// when the account has one.
func (s *AuthService) DisableTOTP(ctx context.Context, userID, password, code string) error {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if !u.TOTPEnabled {
		return nil
	}
	if hasPassword(u) {
		if err := s.hasher.Compare(u.PasswordHash, password); err != nil {
			return domain.ErrInvalidCredentials
		}
	}
	if _, err := s.checkCode(ctx, u, code); err != nil {
		return err
	}
	return s.users.SetTOTP(ctx, userID, nil, false, nil)
}

// RegenerateRecovery replaces every recovery code; it needs a current code.
func (s *AuthService) RegenerateRecovery(ctx context.Context, userID, code string) ([]string, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !u.TOTPEnabled {
		return nil, domain.ErrTOTPNotSetUp
	}
	if _, err := s.checkCode(ctx, u, code); err != nil {
		return nil, err
	}
	plain, hashes, err := newRecoveryCodes()
	if err != nil {
		return nil, err
	}
	return plain, s.users.SetTOTP(ctx, userID, u.TOTPSecret, true, hashes)
}

func (s *AuthService) Sessions(ctx context.Context, userID, current string) ([]domain.Session, error) {
	list, err := s.tokens.Sessions(ctx, userID)
	for i := range list {
		list[i].Current = list[i].ID == current
	}
	return list, err
}

func (s *AuthService) RevokeSession(ctx context.Context, userID, sessionID string) error {
	return s.tokens.RevokeUserSession(ctx, userID, sessionID)
}

// RevokeOtherSessions signs out every device except the current one.
func (s *AuthService) RevokeOtherSessions(ctx context.Context, userID, current string) (int, error) {
	list, err := s.tokens.Sessions(ctx, userID)
	if err != nil {
		return 0, err
	}
	n := 0
	for _, x := range list {
		if x.ID != current {
			if err := s.tokens.RevokeUserSession(ctx, userID, x.ID); err != nil {
				return n, err
			}
			n++
		}
	}
	return n, nil
}

// SSOProfile is what a single sign-on provider says about the person.
type SSOProfile struct {
	Provider, Subject, Email, Name string
	EmailVerified                  bool
}

// SSOLogin signs in through a provider: an existing link, else the account with
// the same verified email (which is then linked), else a new account.
func (s *AuthService) SSOLogin(ctx context.Context, p SSOProfile) (*domain.User, *TokenPair, bool, error) {
	if s.identities == nil {
		return nil, nil, false, apperror.Unavailable("sso_unavailable", "single sign-on is not configured")
	}
	if id, err := s.identities.FindUser(ctx, p.Provider, p.Subject); err == nil {
		u, err := s.users.GetByID(ctx, id)
		if err != nil {
			return nil, nil, false, err
		}
		u, pair, err := s.finishLogin(ctx, u)
		return u, pair, false, err
	} else if !errors.Is(err, domain.ErrUserNotFound) {
		return nil, nil, false, err
	}
	if !p.EmailVerified || strings.TrimSpace(p.Email) == "" {
		return nil, nil, false, domain.ErrSSOUnverified
	}
	email := normalizeEmail(p.Email)
	created := false
	u, err := s.users.GetByEmail(ctx, email)
	if errors.Is(err, domain.ErrUserNotFound) {
		raw, rerr := randomToken(24)
		if rerr != nil {
			return nil, nil, false, rerr
		}
		name := strings.TrimSpace(p.Name)
		if name == "" {
			name = strings.Split(email, "@")[0]
		}
		u = &domain.User{Email: email, FullName: name, Color: colorFor(email), PasswordHash: ssoHashPrefix + hashToken(raw), IsActive: true}
		if err := s.users.Create(ctx, u); err != nil {
			return nil, nil, false, err
		}
		created = true
	} else if err != nil {
		return nil, nil, false, err
	}
	if err := s.identities.Link(ctx, u.ID, p.Provider, p.Subject, email); err != nil {
		return nil, nil, false, err
	}
	u, pair, err := s.finishLogin(ctx, u)
	return u, pair, created, err
}

func (s *AuthService) LinkedAccounts(ctx context.Context, userID string) ([]domain.Identity, error) {
	if s.identities == nil {
		return []domain.Identity{}, nil
	}
	return s.identities.ForUser(ctx, userID)
}

// UserIDByEmail finds an account for audit records of failed sign-ins.
func (s *AuthService) UserIDByEmail(ctx context.Context, email string) string {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if err != nil {
		return ""
	}
	return u.ID
}
