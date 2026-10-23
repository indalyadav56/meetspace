package application

import "context"

// EmailSender delivers transactional email (password resets, invites).
type EmailSender interface {
	SendPasswordReset(ctx context.Context, to, rawToken string) error
	// SendWorkspaceInvite tells someone they were added to a workspace. rawToken
	// is set for people without a password yet, so they can choose one.
	SendWorkspaceInvite(ctx context.Context, to, inviterName, workspaceName, rawToken string) error
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
