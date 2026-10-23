// Package domain holds notifications and reminders.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Notification struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	UserID      string    `json:"-"`
	Kind        string    `json:"kind"`
	TaskID      string    `json:"taskId"`
	ActorID     string    `json:"actorId"`
	Text        string    `json:"text"`
	Read        bool      `json:"read"`
	Cleared     bool      `json:"cleared"`
	Important   bool      `json:"important"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Reminder struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	UserID      string    `json:"-"`
	Text        string    `json:"text"`
	Due         time.Time `json:"due"`
	TaskID      *string   `json:"taskId"`
	Done        bool      `json:"done"`
	Notified    bool      `json:"notified"`
	CreatedAt   time.Time `json:"createdAt"`
}

var (
	ErrNotFound    = apperror.NotFound("not_found", "not found")
	ErrInvalidText = apperror.Invalid("invalid_text", "text must be 1-500 characters")
)

type Repository interface {
	CreateNotification(ctx context.Context, n *Notification) error
	ListNotifications(ctx context.Context, workspaceID, userID string, limit int) ([]Notification, error)
	UpdateNotification(ctx context.Context, id, userID string, read, cleared *bool) (*Notification, error)
	MarkAllRead(ctx context.Context, workspaceID, userID string) error

	CreateReminder(ctx context.Context, r *Reminder) error
	GetReminder(ctx context.Context, id, userID string) (*Reminder, error)
	UpdateReminder(ctx context.Context, r *Reminder) error
	DeleteReminder(ctx context.Context, id, userID string) error
	ListReminders(ctx context.Context, workspaceID, userID string) ([]Reminder, error)
	// ClaimDue marks due reminders notified and returns them (safe across worker replicas).
	ClaimDue(ctx context.Context, now time.Time, limit int) ([]Reminder, error)
}
