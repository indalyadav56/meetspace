package domain

import "errors"

var (
	ErrTaskNotFound    = errors.New("task not found")
	ErrSubtaskNotFound = errors.New("subtask not found")
	ErrInvalidStatus   = errors.New("invalid task status")
	ErrInvalidPriority = errors.New("invalid task priority")
)
