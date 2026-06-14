package model

import "time"

type User struct {
	ID           string
	Email        string
	FullName     string
	PasswordHash string
	IsActive     bool
	IsSuperAdmin bool
	LastLoginAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time
}

type RefreshToken struct {
	ID        string
	UserID    string
	SessionID string
	TokenHash string
	Revoked   bool
	Parent    *string
	ExpiresAt time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type PasswordResetToken struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}
