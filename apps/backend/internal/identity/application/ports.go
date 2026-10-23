package application

import "context"

// EmailSender delivers transactional email (password resets, invites).
type EmailSender interface {
	SendPasswordReset(ctx context.Context, to, rawToken string) error
}

// TokenSigner issues signed access tokens.
type TokenSigner interface {
	GenerateToken(claims map[string]interface{}) (string, error)
}

// PasswordHasher hashes and verifies passwords.
type PasswordHasher interface {
	Hash(plain string) (string, error)
	Compare(hash, plain string) error
}
