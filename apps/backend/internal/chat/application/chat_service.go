package application

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/chat/domain"
)

type ChatService struct {
	channels domain.ChannelRepository
	messages domain.MessageRepository
	teams    TeamChecker
	log      *slog.Logger
}

func NewChatService(channels domain.ChannelRepository, messages domain.MessageRepository, teams TeamChecker, log *slog.Logger) *ChatService {
	return &ChatService{channels: channels, messages: messages, teams: teams, log: log}
}

func (s *ChatService) ListChannels(ctx context.Context, teamID string) ([]domain.Channel, error) {
	if err := s.teams.TeamExists(ctx, teamID); err != nil {
		return nil, err
	}
	return s.channels.ListByTeam(ctx, teamID)
}

type CreateChannelInput struct {
	TeamID      string
	Name        string
	Description string
	Private     bool
}

func (s *ChatService) CreateChannel(ctx context.Context, in CreateChannelInput) (*domain.Channel, error) {
	if err := s.teams.TeamExists(ctx, in.TeamID); err != nil {
		return nil, err
	}
	ch := &domain.Channel{
		ID:          uuid.NewString(),
		TeamID:      in.TeamID,
		Name:        strings.TrimSpace(in.Name),
		Description: in.Description,
		Private:     in.Private,
		CreatedAt:   time.Now().UTC(),
	}
	if err := s.channels.Create(ctx, ch); err != nil {
		return nil, err
	}
	return ch, nil
}

func (s *ChatService) Messages(ctx context.Context, conversationID string) ([]domain.Message, error) {
	return s.messages.ListByConversation(ctx, conversationID)
}

type SendMessageInput struct {
	ConversationID string
	AuthorID       string
	Body           string
	ParentID       *string
}

func (s *ChatService) Send(ctx context.Context, in SendMessageInput) (*domain.Message, error) {
	body := strings.TrimSpace(in.Body)
	if body == "" {
		return nil, domain.ErrEmptyBody
	}
	if in.ParentID != nil {
		if _, err := s.messages.FindByID(ctx, *in.ParentID); err != nil {
			return nil, err
		}
	}
	m := &domain.Message{
		ID:             uuid.NewString(),
		ConversationID: in.ConversationID,
		AuthorID:       in.AuthorID,
		Body:           body,
		ParentID:       in.ParentID,
		CreatedAt:      time.Now().UTC(),
	}
	if err := s.messages.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}
