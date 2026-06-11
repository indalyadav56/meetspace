package v1

import (
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/chat/domain"
)

type ChannelResponse struct {
	ID          string    `json:"id"`
	TeamID      string    `json:"teamId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Private     bool      `json:"private"`
	CreatedAt   time.Time `json:"createdAt"`
}

func toChannelResponse(ch *domain.Channel) ChannelResponse {
	return ChannelResponse{
		ID:          ch.ID,
		TeamID:      ch.TeamID,
		Name:        ch.Name,
		Description: ch.Description,
		Private:     ch.Private,
		CreatedAt:   ch.CreatedAt,
	}
}

type CreateChannelRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Private     bool   `json:"private"`
}

type MessageResponse struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversationId"`
	AuthorID       string    `json:"authorId"`
	Body           string    `json:"body"`
	ParentID       *string   `json:"parentId"`
	Edited         bool      `json:"edited"`
	System         bool      `json:"system"`
	CreatedAt      time.Time `json:"createdAt"`
}

func toMessageResponse(m *domain.Message) MessageResponse {
	return MessageResponse{
		ID:             m.ID,
		ConversationID: m.ConversationID,
		AuthorID:       m.AuthorID,
		Body:           m.Body,
		ParentID:       m.ParentID,
		Edited:         m.Edited,
		System:         m.System,
		CreatedAt:      m.CreatedAt,
	}
}

type SendMessageRequest struct {
	AuthorID string  `json:"authorId" binding:"required"`
	Body     string  `json:"body" binding:"required"`
	ParentID *string `json:"parentId"`
}
