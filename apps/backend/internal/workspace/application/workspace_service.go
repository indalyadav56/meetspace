package application

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

type WorkspaceService struct {
	users domain.UserRepository
	teams domain.TeamRepository
	log   *slog.Logger
}

func NewWorkspaceService(users domain.UserRepository, teams domain.TeamRepository, log *slog.Logger) *WorkspaceService {
	return &WorkspaceService{users: users, teams: teams, log: log}
}

func (s *WorkspaceService) ListUsers(ctx context.Context) ([]domain.User, error) {
	return s.users.List(ctx)
}

func (s *WorkspaceService) GetUser(ctx context.Context, id string) (*domain.User, error) {
	return s.users.FindByID(ctx, id)
}

type CreateUserInput struct {
	Name  string
	Email string
	Color string
	Role  string
}

func (s *WorkspaceService) CreateUser(ctx context.Context, in CreateUserInput) (*domain.User, error) {
	u := &domain.User{
		ID:        uuid.NewString(),
		Name:      strings.TrimSpace(in.Name),
		Email:     strings.ToLower(strings.TrimSpace(in.Email)),
		Initials:  initials(in.Name),
		Color:     in.Color,
		Role:      in.Role,
		Presence:  domain.PresenceOffline,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *WorkspaceService) ListTeams(ctx context.Context) ([]domain.Team, error) {
	return s.teams.List(ctx)
}

func (s *WorkspaceService) GetTeam(ctx context.Context, id string) (*domain.Team, error) {
	return s.teams.FindByID(ctx, id)
}

type CreateTeamInput struct {
	Name        string
	Key         string
	Description string
	Color       string
	Icon        string
	LeadID      string
	MemberIDs   []string
}

func (s *WorkspaceService) CreateTeam(ctx context.Context, in CreateTeamInput) (*domain.Team, error) {
	key := strings.ToUpper(strings.TrimSpace(in.Key))
	if err := domain.ValidateKey(key); err != nil {
		return nil, err
	}
	t := &domain.Team{
		ID:          uuid.NewString(),
		Name:        strings.TrimSpace(in.Name),
		Key:         key,
		Description: in.Description,
		Color:       in.Color,
		Icon:        in.Icon,
		LeadID:      in.LeadID,
		MemberIDs:   in.MemberIDs,
		CreatedAt:   time.Now().UTC(),
	}
	if err := s.teams.Create(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

// TeamKey returns the short key for a team. Other bounded contexts consume
// this through their own ports (e.g. tasks.TeamInfo) — they never import
// this package; Go's structural typing connects them in the composition root.
func (s *WorkspaceService) TeamKey(ctx context.Context, teamID string) (string, error) {
	t, err := s.teams.FindByID(ctx, teamID)
	if err != nil {
		return "", err
	}
	return t.Key, nil
}

func initials(name string) string {
	parts := strings.Fields(name)
	out := ""
	for _, p := range parts {
		out += strings.ToUpper(p[:1])
		if len(out) == 2 {
			break
		}
	}
	return out
}

// TeamExists reports whether a team exists, returning domain.ErrTeamNotFound
// when it does not. Consumed by other contexts through their own ports.
func (s *WorkspaceService) TeamExists(ctx context.Context, teamID string) error {
	_, err := s.teams.FindByID(ctx, teamID)
	return err
}
