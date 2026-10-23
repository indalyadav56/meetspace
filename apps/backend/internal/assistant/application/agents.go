package application

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/indalyadav56/meetspace/backend/internal/assistant/domain"
)

// AgentInput creates or replaces an agent's editable fields.
type AgentInput struct {
	ID           string `json:"id"` // optional client-generated id
	Name         string `json:"name"`
	Description  string `json:"description"`
	Instructions string `json:"instructions"`
	Icon         string `json:"icon"`
}

func (in *AgentInput) clean() error {
	in.Name, in.Description, in.Instructions, in.Icon = strings.TrimSpace(in.Name), strings.TrimSpace(in.Description), strings.TrimSpace(in.Instructions), strings.TrimSpace(in.Icon)
	if in.Name == "" || utf8.RuneCountInString(in.Name) > 80 || utf8.RuneCountInString(in.Description) > 255 || utf8.RuneCountInString(in.Instructions) > 4000 {
		return domain.ErrInvalidAgent
	}
	if in.Icon == "" || utf8.RuneCountInString(in.Icon) > 4 {
		in.Icon = "✨"
	}
	return nil
}

func (s *Service) Agents(ctx context.Context, ws string) ([]domain.Agent, error) {
	return s.agents.List(ctx, ws)
}

func (s *Service) CreateAgent(ctx context.Context, ws, userID string, in AgentInput) (*domain.Agent, error) {
	if err := in.clean(); err != nil {
		return nil, err
	}
	a := &domain.Agent{ID: in.ID, WorkspaceID: ws, Name: in.Name, Description: in.Description, Instructions: in.Instructions, Icon: in.Icon, CreatedBy: &userID}
	if err := s.agents.Create(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) UpdateAgent(ctx context.Context, ws, id string, in AgentInput) (*domain.Agent, error) {
	if err := in.clean(); err != nil {
		return nil, err
	}
	a, err := s.agents.Get(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	a.Name, a.Description, a.Instructions, a.Icon = in.Name, in.Description, in.Instructions, in.Icon
	if err := s.agents.Update(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) DeleteAgent(ctx context.Context, ws, id string) error {
	if _, err := s.agents.Get(ctx, ws, id); err != nil {
		return err
	}
	return s.agents.Delete(ctx, ws, id)
}

// withAgent adds an agent's standing instructions to the turn's context.
func (s *Service) withAgent(ctx context.Context, req *RunRequest) error {
	if req.AgentID == "" {
		return nil
	}
	a, err := s.agents.Get(ctx, req.WorkspaceID, req.AgentID)
	if err != nil {
		return err
	}
	req.Context = "You are acting as the workspace agent “" + a.Name + "”. Follow these standing instructions from the team:\n" + a.Instructions + "\n\n" + req.Context
	return nil
}
