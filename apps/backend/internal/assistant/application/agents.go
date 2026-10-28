package application

import (
	"context"
	"strings"
	"time"
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
	Kind         string `json:"kind"`    // "agent" (default) or "skill"; fixed once created
	Enabled      *bool  `json:"enabled"` // skills can be switched off without deleting them
	// Scheduled runs (agents only).
	Schedule       string  `json:"schedule"`
	ScheduleTime   string  `json:"scheduleTime"`
	ScheduleDay    int     `json:"scheduleDay"`
	Timezone       string  `json:"timezone"`
	SchedulePrompt string  `json:"schedulePrompt"`
	ChannelID      *string `json:"channelId"`
}

func (in *AgentInput) clean() error {
	in.Name, in.Description, in.Instructions, in.Icon = strings.TrimSpace(in.Name), strings.TrimSpace(in.Description), strings.TrimSpace(in.Instructions), strings.TrimSpace(in.Icon)
	if in.Name == "" || utf8.RuneCountInString(in.Name) > 80 || utf8.RuneCountInString(in.Description) > 255 || utf8.RuneCountInString(in.Instructions) > 4000 {
		return domain.ErrInvalidAgent
	}
	if in.Icon == "" || utf8.RuneCountInString(in.Icon) > 4 {
		in.Icon = "✨"
	}
	if in.Kind != domain.KindSkill {
		in.Kind = domain.KindAgent
	}
	return in.cleanSchedule()
}

func (s *Service) Agents(ctx context.Context, ws string) ([]domain.Agent, error) {
	return s.agents.List(ctx, ws)
}

func (s *Service) CreateAgent(ctx context.Context, ws, userID string, in AgentInput) (*domain.Agent, error) {
	if err := in.clean(); err != nil {
		return nil, err
	}
	a := &domain.Agent{ID: in.ID, WorkspaceID: ws, Name: in.Name, Description: in.Description, Instructions: in.Instructions, Icon: in.Icon, Kind: in.Kind, Enabled: in.Enabled == nil || *in.Enabled, CreatedBy: &userID}
	if err := s.agents.Create(ctx, a); err != nil {
		return nil, err
	}
	if in.Kind == domain.KindAgent && in.Schedule != "" && in.Schedule != "none" {
		applySchedule(a, in, time.Now())
		if err := s.agents.Update(ctx, a); err != nil {
			return nil, err
		}
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
	if in.Enabled != nil {
		a.Enabled = *in.Enabled
	}
	if a.Kind == domain.KindAgent && in.Schedule != "" {
		applySchedule(a, in, time.Now())
	}
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
	if a.Kind == domain.KindSkill {
		if !a.Enabled {
			return domain.ErrSkillDisabled
		}
		req.Context = "Apply the workspace skill “" + a.Name + "” to the user's request. Do the work the way the skill describes, using the workspace tools when they help:\n" + a.Instructions + "\n\n" + req.Context
		return nil
	}
	req.Context = "You are acting as the workspace agent “" + a.Name + "”. Follow these standing instructions from the team:\n" + a.Instructions + "\n\n" + req.Context
	return nil
}
