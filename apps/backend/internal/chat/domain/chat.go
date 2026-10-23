// Package domain holds channels, direct messages and messages.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Channel struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	Name        string    `json:"name"`
	Kind        string    `json:"kind"` // channel | dm
	Members     []string  `json:"members"`
	Topic       string    `json:"topic"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Message struct {
	ID        string              `json:"id"`
	ChannelID string              `json:"channelId"`
	UserID    string              `json:"userId"`
	Text      string              `json:"text"`
	CreatedAt time.Time           `json:"createdAt"`
	ParentID  *string             `json:"parentId"`
	TaskID    *string             `json:"taskId"`
	ClipID    *string             `json:"clipId"`
	CallID    *string             `json:"callId"`
	Reactions map[string][]string `json:"reactions"`
	Edited    bool                `json:"edited"`
}

var (
	ErrChannelNotFound = apperror.NotFound("channel_not_found", "channel not found")
	ErrMessageNotFound = apperror.NotFound("message_not_found", "message not found")
	ErrNotInDM         = apperror.Forbidden("not_in_conversation", "you are not part of this conversation")
	ErrNotAuthor       = apperror.Forbidden("not_author", "you can only change your own messages")
	ErrInvalidMessage  = apperror.Invalid("invalid_message", "message must be 1-8000 characters")
)

type Repository interface {
	CreateChannel(ctx context.Context, c *Channel) error
	GetChannel(ctx context.Context, ws, id string) (*Channel, error)
	ListChannels(ctx context.Context, ws string) ([]Channel, error)
	FindDM(ctx context.Context, ws, a, b string) (*Channel, error)

	CreateMessage(ctx context.Context, ws string, m *Message) error
	GetMessage(ctx context.Context, ws, id string) (*Message, error)
	UpdateMessage(ctx context.Context, ws string, m *Message) error
	// DeleteMessage removes a message and its thread replies, returning every deleted id.
	DeleteMessage(ctx context.Context, ws, id string) ([]string, error)
	// RecentMessages returns up to perChannel latest top-level messages per channel plus all their replies.
	RecentMessages(ctx context.Context, ws string, channelIDs []string, perChannel int) ([]Message, error)

	SetRead(ctx context.Context, channelID, userID string, at time.Time) error
	ReadState(ctx context.Context, ws, userID string) (map[string]time.Time, error)
}
