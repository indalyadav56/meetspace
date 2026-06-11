package domain

import "context"

type ChannelRepository interface {
	ListByTeam(ctx context.Context, teamID string) ([]Channel, error)
	FindByID(ctx context.Context, id string) (*Channel, error)
	Create(ctx context.Context, ch *Channel) error
}

type MessageRepository interface {
	ListByConversation(ctx context.Context, conversationID string) ([]Message, error)
	FindByID(ctx context.Context, id string) (*Message, error)
	Create(ctx context.Context, m *Message) error
}
