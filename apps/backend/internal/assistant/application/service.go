package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Service struct {
	agent Agent // nil when no model is configured
}

func NewService(agent Agent) *Service { return &Service{agent: agent} }

var ErrDisabled = apperror.Unavailable("assistant_disabled", "the AI assistant is not configured on this server")

func (s *Service) Enabled() bool { return s.agent != nil }

func (s *Service) Model() string {
	if s.agent == nil {
		return ""
	}
	return s.agent.Model()
}

// Chat runs one turn. A missing session id starts a new conversation.
func (s *Service) Chat(ctx context.Context, req RunRequest, emit func(Event)) error {
	if s.agent == nil {
		return ErrDisabled
	}
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" || len(req.Message) > 8000 {
		return apperror.Invalid("invalid_message", "message must be 1-8000 characters")
	}
	if len(req.Context) > 4000 {
		req.Context = req.Context[:4000]
	}
	if req.SessionID == "" {
		req.SessionID = uuid.NewString()
	}
	return s.agent.Run(ctx, req, emit)
}
