package domain

import "errors"

var (
	ErrMeetingNotFound = errors.New("meeting not found")
	ErrInvalidTimeSpan = errors.New("meeting must end after it starts")
)
