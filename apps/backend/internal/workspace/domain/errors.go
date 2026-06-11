package domain

import "errors"

var (
	ErrUserNotFound   = errors.New("user not found")
	ErrTeamNotFound   = errors.New("team not found")
	ErrEmailTaken     = errors.New("email already in use")
	ErrTeamKeyTaken   = errors.New("team key already in use")
	ErrInvalidTeamKey = errors.New("team key must be 2-6 uppercase letters")
)
