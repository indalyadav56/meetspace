// Package domain holds the identity context's entities and repository ports.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type User struct {
	ID           string
	Email        string
	FullName     string
	Color        string
	StatusEmoji  string
	StatusText   string
	StatusUntil  *time.Time
	PasswordHash string
	// TOTPSecret is sealed; TOTPEnabled turns it on once a first code checks out.
	TOTPSecret   []byte
	TOTPEnabled  bool
	TOTPRecovery []string
	IsActive     bool
	LastLoginAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type RefreshToken struct {
	ID        string
	UserID    string
	SessionID string
	TokenHash string
	Revoked   bool
	Parent    *string
	ExpiresAt time.Time
	UserAgent string
	IP        string
}

// Session is one signed-in device: the live tokens sharing a session id.
type Session struct {
	ID        string    `json:"id"`
	UserAgent string    `json:"userAgent"`
	IP        string    `json:"ip"`
	StartedAt time.Time `json:"startedAt"`
	LastSeen  time.Time `json:"lastSeen"`
	Current   bool      `json:"current"`
}

// Identity links a user to an account at a single sign-on provider.
type Identity struct {
	Provider  string    `json:"provider"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

type PasswordResetToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	UsedAt    *time.Time
}

var (
	ErrUserNotFound       = apperror.NotFound("user_not_found", "user not found")
	ErrEmailExists        = apperror.Conflict("email_exists", "an account with this email already exists")
	ErrInvalidCredentials = apperror.Unauthorized("invalid_credentials", "invalid email or password")
	ErrUserInactive       = apperror.Forbidden("user_inactive", "this account is disabled")
	ErrTokenNotFound      = apperror.Unauthorized("invalid_token", "token is invalid")
	ErrTokenExpired       = apperror.Unauthorized("token_expired", "token has expired")
	ErrTokenReused        = apperror.Unauthorized("token_reused", "token was already used; session revoked")
	ErrTokenRevoked       = apperror.Unauthorized("token_revoked", "token was revoked")
	ErrBadCode            = apperror.Invalid("invalid_code", "that code didn't work — check your authenticator app and try again")
	ErrMFAExpired         = apperror.Unauthorized("mfa_expired", "the sign-in took too long; start again")
	ErrTOTPNotSetUp       = apperror.Invalid("totp_not_set_up", "start two-factor setup first")
	ErrSSOUnverified      = apperror.Forbidden("sso_email_unverified", "your provider hasn't verified this email address")
)

type UserRepository interface {
	Create(ctx context.Context, u *User) error
	GetByID(ctx context.Context, id string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	ListByIDs(ctx context.Context, ids []string) ([]User, error)
	UpdateProfile(ctx context.Context, id, fullName, color string) error
	UpdateStatus(ctx context.Context, id, emoji, text string, until *time.Time) error
	UpdatePassword(ctx context.Context, id, hash string) error
	UpdateLastLogin(ctx context.Context, id string, at time.Time) error
	SetTOTP(ctx context.Context, id string, sealed []byte, enabled bool, recovery []string) error
}

type IdentityRepository interface {
	FindUser(ctx context.Context, provider, subject string) (string, error)
	Link(ctx context.Context, userID, provider, subject, email string) error
	ForUser(ctx context.Context, userID string) ([]Identity, error)
}

type RefreshTokenRepository interface {
	Create(ctx context.Context, t *RefreshToken) error
	GetByHash(ctx context.Context, hash string) (*RefreshToken, error)
	Revoke(ctx context.Context, id string) error
	RevokeSession(ctx context.Context, sessionID string) error
	RevokeAllForUser(ctx context.Context, userID string) error
	Sessions(ctx context.Context, userID string) ([]Session, error)
	RevokeUserSession(ctx context.Context, userID, sessionID string) error
}

type PasswordResetTokenRepository interface {
	Create(ctx context.Context, t *PasswordResetToken) error
	GetByHash(ctx context.Context, hash string) (*PasswordResetToken, error)
	MarkUsed(ctx context.Context, id string, at time.Time) error
}
