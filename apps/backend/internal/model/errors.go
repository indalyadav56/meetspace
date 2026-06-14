package model

import "errors"

// Sentinel errors returned by the repository and service layers. Handlers map
// these to HTTP status codes and stable error codes; nothing else should depend
// on their string values.
var (
	// ErrUserNotFound is returned when a user lookup matches no active row.
	ErrUserNotFound = errors.New("user not found")
	// ErrEmailExists is returned when registering an email that already exists.
	ErrEmailExists = errors.New("email already registered")
	// ErrInvalidCredentials is returned for a bad email/password combination.
	// It is intentionally indistinguishable from "user not found" so callers
	// cannot enumerate accounts.
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrUserInactive is returned when a deactivated user attempts to log in.
	ErrUserInactive = errors.New("user is inactive")

	// ErrTokenNotFound is returned when a refresh or reset token does not exist.
	ErrTokenNotFound = errors.New("token not found")
	// ErrTokenExpired is returned when a token is past its expiry.
	ErrTokenExpired = errors.New("token expired")
	// ErrTokenRevoked is returned when a token has been revoked or already used.
	ErrTokenRevoked = errors.New("token revoked")
	// ErrTokenReused is returned when an already-rotated refresh token is
	// presented again, which we treat as a theft signal.
	ErrTokenReused = errors.New("token reuse detected")
)
