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

// Preferences says how a person wants to hear about notifications outside the app.
type Preferences struct {
	// EmailMode is "instant" (a few minutes after, if still unread), "digest" (once a day) or "off".
	EmailMode   string     `json:"emailMode"`
	EmailKinds  []string   `json:"emailKinds"`
	PushEnabled bool       `json:"pushEnabled"`
	PushKinds   []string   `json:"pushKinds"`
	DigestHour  int        `json:"digestHour"`
	Timezone    string     `json:"timezone"`
	QuietStart  int        `json:"quietStart"`
	QuietEnd    int        `json:"quietEnd"`
	PausedUntil *time.Time `json:"pausedUntil"`
}

func DefaultPreferences() Preferences {
	return Preferences{
		EmailMode: "digest", EmailKinds: []string{"mention", "assigned", "comment", "due", "reminder", "timesheet"},
		PushEnabled: true, PushKinds: []string{"mention", "assigned", "comment", "due", "reminder", "status", "timesheet"},
		DigestHour: 8, Timezone: "UTC", QuietStart: -1, QuietEnd: -1,
	}
}

// PushSubscription is one browser that accepted push notifications.
type PushSubscription struct {
	ID        string `json:"id"`
	UserID    string `json:"-"`
	Endpoint  string `json:"endpoint"`
	P256dh    string `json:"-"`
	Auth      string `json:"-"`
	UserAgent string `json:"userAgent"`
}

// Outgoing is a notification with what's needed to render it in an email or push.
type Outgoing struct {
	Notification
	WorkspaceName string
	RecipientName string
	RecipientMail string
	ActorName     string
	TaskTitle     string
	TaskKey       int64
	Prefs         Preferences
}

// DueTask is a task in someone's daily digest.
type DueTask struct {
	ID       string
	Key      int64
	Title    string
	DueDate  string
	Overdue  bool
	ListName string
}

// DeliveryRepository is the storage behind email and push delivery.
type DeliveryRepository interface {
	Preferences(ctx context.Context, userID string) (Preferences, error)
	SavePreferences(ctx context.Context, userID string, p Preferences) error
	SaveSubscription(ctx context.Context, s PushSubscription) error
	DeleteSubscription(ctx context.Context, userID, endpoint string) error
	Subscriptions(ctx context.Context, userID string) ([]PushSubscription, error)
	TouchSubscription(ctx context.Context, id string) error
	// VAPID returns the key pair, storing generate()'s result the first time.
	VAPID(ctx context.Context, generate func() (pub, priv string, err error)) (pub, priv string, err error)
	// ClaimPush marks notifications older than `before` as pushed and returns them.
	ClaimPush(ctx context.Context, before time.Time, limit int) ([]Outgoing, error)
	// ClaimInstantEmail does the same for people who want instant email.
	ClaimInstantEmail(ctx context.Context, before time.Time, limit int) ([]Outgoing, error)
	// DigestRecipients lists people whose digest hour is now and who haven't had one today.
	DigestRecipients(ctx context.Context, now time.Time) ([]string, error)
	// ClaimDigest takes a person's unread, unsent notifications from the last day.
	ClaimDigest(ctx context.Context, userID string, now time.Time) ([]Outgoing, error)
	DueTasks(ctx context.Context, userID string, today string) ([]DueTask, error)
}
