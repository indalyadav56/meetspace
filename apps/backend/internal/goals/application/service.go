// Package application implements goal use cases.
package application

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/goals/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

var palette = []string{"#4f46e5", "#14b8a6", "#f43f5e", "#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981", "#ec4899"}

var targetKinds = map[string]bool{"number": true, "currency": true, "boolean": true, "tasks": true}

type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

type Service struct {
	repo domain.Repository
	pub  Publisher
}

func NewService(repo domain.Repository, pub Publisher) *Service {
	return &Service{repo: repo, pub: pub}
}

func (s *Service) Create(ctx context.Context, ws, id, ownerID string) (*domain.Goal, error) {
	existing, err := s.repo.List(ctx, ws)
	if err != nil {
		return nil, err
	}
	g := &domain.Goal{ID: id, WorkspaceID: ws, Name: "New goal", Color: palette[len(existing)%len(palette)], OwnerID: ownerID, Folder: "Goals", Targets: []domain.Target{}}
	if err := s.repo.Create(ctx, g); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "goals", "upsert", g, nil)
	return g, nil
}

type Patch struct {
	Name        *string          `json:"name"`
	Description *string          `json:"description"`
	Color       *string          `json:"color"`
	OwnerID     *string          `json:"ownerId"`
	DueDate     *string          `json:"dueDate"`
	ClearDue    bool             `json:"clearDue"`
	Folder      *string          `json:"folder"`
	Targets     *[]domain.Target `json:"targets"`
}

func (s *Service) Update(ctx context.Context, ws, id string, p Patch) (*domain.Goal, error) {
	g, err := s.repo.Get(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.Name != nil {
		n := strings.TrimSpace(*p.Name)
		if n == "" || len(n) > 200 {
			return nil, apperror.Invalid("invalid_name", "goal name must be 1-200 characters")
		}
		g.Name = n
	}
	if p.Description != nil {
		g.Description = *p.Description
	}
	if p.Color != nil {
		if !hexColor.MatchString(*p.Color) {
			return nil, apperror.Invalid("invalid_color", "color must be #rrggbb")
		}
		g.Color = *p.Color
	}
	if p.OwnerID != nil {
		g.OwnerID = *p.OwnerID
	}
	if p.DueDate != nil {
		if _, err := time.Parse("2006-01-02", *p.DueDate); err != nil {
			return nil, apperror.Invalid("invalid_date", "dates must be YYYY-MM-DD")
		}
		g.DueDate = p.DueDate
	}
	if p.ClearDue {
		g.DueDate = nil
	}
	if p.Folder != nil {
		f := strings.TrimSpace(*p.Folder)
		if f == "" {
			f = "Goals"
		}
		g.Folder = f
	}
	if p.Targets != nil {
		ts := *p.Targets
		if len(ts) > 30 {
			return nil, apperror.Invalid("too_many_targets", "a goal can have at most 30 targets")
		}
		for i := range ts {
			if !targetKinds[ts[i].Kind] || strings.TrimSpace(ts[i].Name) == "" {
				return nil, apperror.Invalid("invalid_target", "each target needs a name and a valid kind")
			}
			if ts[i].ID == "" {
				ts[i].ID = uuid.NewString()
			}
		}
		g.Targets = ts
	}
	if err := s.repo.Update(ctx, g); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "goals", "upsert", g, nil)
	return g, nil
}

func (s *Service) Delete(ctx context.Context, ws, id string) error {
	if err := s.repo.Delete(ctx, ws, id); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "goals", "delete", map[string]string{"id": id}, nil)
	return nil
}

func (s *Service) Snapshot(ctx context.Context, ws, _ string) (map[string]any, error) {
	gs, err := s.repo.List(ctx, ws)
	if err != nil {
		return nil, err
	}
	if gs == nil {
		gs = []domain.Goal{}
	}
	return map[string]any{"goals": gs}, nil
}
