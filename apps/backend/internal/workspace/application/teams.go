package application

import (
	"context"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

// TeamInput is the editable part of a team.
type TeamInput struct {
	ID          string
	Name        string
	Color       string
	Description string
	LeadID      *string
	Members     []string
}

// requireMember allows anyone but guests.
func (s *Service) requireMember(ctx context.Context, workspaceID, actorID string) error {
	r, err := s.repo.Role(ctx, workspaceID, actorID)
	if err != nil {
		return err
	}
	if r == domain.RoleGuest {
		return domain.ErrForbidden
	}
	return nil
}

func (s *Service) memberSet(ctx context.Context, workspaceID string) (map[string]domain.Member, error) {
	w, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	out := make(map[string]domain.Member, len(w.Members))
	for _, m := range w.Members {
		out[m.UserID] = m
	}
	return out, nil
}

func (s *Service) ListTeams(ctx context.Context, workspaceID string) ([]domain.Team, error) {
	return s.repo.ListTeams(ctx, workspaceID)
}

// SaveTeam creates a team (empty ID or an unknown client id) or updates one.
func (s *Service) SaveTeam(ctx context.Context, workspaceID, actorID string, in TeamInput, create bool) (*domain.Team, error) {
	if err := s.requireMember(ctx, workspaceID, actorID); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" || len(name) > 80 {
		return nil, domain.ErrTeamName
	}
	if !hexColor.MatchString(in.Color) {
		in.Color = "#0b7f71"
	}
	if !create {
		if _, err := s.repo.GetTeam(ctx, workspaceID, in.ID); err != nil {
			return nil, err
		}
	}
	members, err := s.memberSet(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	// Only workspace members can be on a team; the lead is always one of them.
	seen := map[string]bool{}
	ids := []string{}
	for _, id := range in.Members {
		if _, ok := members[id]; ok && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if in.LeadID != nil {
		if _, ok := members[*in.LeadID]; !ok {
			in.LeadID = nil
		} else if !seen[*in.LeadID] {
			ids = append(ids, *in.LeadID)
		}
	}
	t := &domain.Team{ID: in.ID, WorkspaceID: workspaceID, Name: name, Color: in.Color, Description: strings.TrimSpace(in.Description), LeadID: in.LeadID, Members: ids, CreatedBy: actorID}
	if err := s.repo.SaveTeam(ctx, t); err != nil {
		return nil, err
	}
	saved, err := s.repo.GetTeam(ctx, workspaceID, t.ID)
	if err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, workspaceID, "teams", "upsert", saved, nil)
	return saved, nil
}

func (s *Service) DeleteTeam(ctx context.Context, workspaceID, actorID, id string) error {
	if err := s.requireMember(ctx, workspaceID, actorID); err != nil {
		return err
	}
	if err := s.repo.DeleteTeam(ctx, workspaceID, id); err != nil {
		return err
	}
	s.pub.Publish(ctx, workspaceID, "teams", "delete", map[string]string{"id": id}, nil)
	return nil
}

// SetProfile changes someone's title and manager. People may edit their own title;
// reporting lines and other people's titles need an admin.
func (s *Service) SetProfile(ctx context.Context, workspaceID, actorID, userID string, title *string, managerID *string, setManager bool) (map[string]any, error) {
	members, err := s.memberSet(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	m, ok := members[userID]
	if !ok {
		return nil, domain.ErrNotMember
	}
	if setManager || actorID != userID {
		if err := s.requireManager(ctx, workspaceID, actorID); err != nil {
			return nil, err
		}
	}
	if title != nil {
		t := strings.TrimSpace(*title)
		if len(t) > 120 {
			t = t[:120]
		}
		m.Title = t
	}
	if setManager {
		if managerID != nil {
			if _, ok := members[*managerID]; !ok {
				return nil, domain.ErrManagerUnknown
			}
			// Walk up from the new manager; reaching userID means a loop.
			for cur, steps := *managerID, 0; steps <= len(members); steps++ {
				if cur == userID {
					return nil, domain.ErrManagerCycle
				}
				next := members[cur].ManagerID
				if next == nil {
					break
				}
				cur = *next
			}
		}
		m.ManagerID = managerID
	}
	if err := s.repo.SetMemberProfile(ctx, workspaceID, userID, m.Title, m.ManagerID); err != nil {
		return nil, err
	}
	return s.publishMember(ctx, workspaceID, m)
}
