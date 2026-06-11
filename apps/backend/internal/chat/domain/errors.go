package domain

import "errors"

var (
	ErrChannelNotFound = errors.New("channel not found")
	ErrMessageNotFound = errors.New("message not found")
	ErrEmptyBody       = errors.New("message body must not be empty")
)
