package domain

import "time"

// Message lives in a conversation: a channel id or a direct-chat id.
// ParentID set means it is a reply inside a thread.
type Message struct {
	ID             string
	ConversationID string
	AuthorID       string
	Body           string
	ParentID       *string
	Edited         bool
	System         bool
	CreatedAt      time.Time
}
