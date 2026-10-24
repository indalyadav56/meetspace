// Package application implements doc and whiteboard use cases.
package application

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/docs/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

const (
	maxDocBytes        = 2 << 20 // 2 MiB of HTML
	maxWhiteboardBytes = 4 << 20
)

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

func (s *Service) CreateDoc(ctx context.Context, ws, actorID, id string, projectID *string, title, content, emoji string) (*domain.Doc, error) {
	if len(content) > maxDocBytes {
		return nil, domain.ErrTooLarge
	}
	if emoji == "" {
		emoji = "📄"
	}
	d := &domain.Doc{ID: id, WorkspaceID: ws, ProjectID: projectID, Title: strings.TrimSpace(title), Content: content, Emoji: emoji, CreatedBy: actorID}
	if err := s.repo.CreateDoc(ctx, d); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "docs", "upsert", d, nil)
	return d, nil
}

type DocPatch struct {
	Title     *string `json:"title"`
	Content   *string `json:"content"`
	Emoji     *string `json:"emoji"`
	ProjectID *string `json:"projectId"`
	// ClearProject moves the doc to the workspace level.
	ClearProject bool `json:"clearProject"`
}

func (s *Service) UpdateDoc(ctx context.Context, ws, id string, p DocPatch) (*domain.Doc, error) {
	d, err := s.repo.GetDoc(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.Title != nil {
		if len(*p.Title) > 500 {
			return nil, apperror.Invalid("invalid_title", "title is too long")
		}
		d.Title = *p.Title
	}
	if p.Content != nil {
		if len(*p.Content) > maxDocBytes {
			return nil, domain.ErrTooLarge
		}
		d.Content = *p.Content
	}
	if p.Emoji != nil && *p.Emoji != "" {
		d.Emoji = *p.Emoji
	}
	if p.ProjectID != nil {
		d.ProjectID = p.ProjectID
	}
	if p.ClearProject {
		d.ProjectID = nil
	}
	if err := s.repo.UpdateDoc(ctx, d); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "docs", "upsert", d, nil)
	return d, nil
}

// DeleteDoc moves a doc to the trash.
func (s *Service) DeleteDoc(ctx context.Context, ws, actorID, id string) error {
	if err := s.repo.DeleteDoc(ctx, ws, id, actorID); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "docs", "delete", map[string]string{"id": id}, nil)
	return nil
}

func (s *Service) ListDocs(ctx context.Context, ws string) ([]domain.Doc, error) {
	return s.repo.ListDocs(ctx, ws)
}

func (s *Service) GetDoc(ctx context.Context, ws, id string) (*domain.Doc, error) {
	return s.repo.GetDoc(ctx, ws, id)
}

func (s *Service) CreateWhiteboard(ctx context.Context, ws, actorID, id, title string) (*domain.Whiteboard, error) {
	if strings.TrimSpace(title) == "" {
		title = "Untitled whiteboard"
	}
	w := &domain.Whiteboard{ID: id, WorkspaceID: ws, Title: title, Items: json.RawMessage("[]"), CreatedBy: actorID}
	if err := s.repo.CreateWhiteboard(ctx, w); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "whiteboards", "upsert", w, nil)
	return w, nil
}

type WhiteboardPatch struct {
	Title *string          `json:"title"`
	Items *json.RawMessage `json:"items"`
}

func (s *Service) UpdateWhiteboard(ctx context.Context, ws, id string, p WhiteboardPatch) (*domain.Whiteboard, error) {
	w, err := s.repo.GetWhiteboard(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.Title != nil {
		w.Title = *p.Title
	}
	if p.Items != nil {
		if len(*p.Items) > maxWhiteboardBytes || !json.Valid(*p.Items) || (*p.Items)[0] != '[' {
			return nil, apperror.Invalid("invalid_items", "items must be a JSON array under 4 MiB")
		}
		w.Items = *p.Items
	}
	if err := s.repo.UpdateWhiteboard(ctx, w); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "whiteboards", "upsert", w, nil)
	return w, nil
}

// DeleteWhiteboard moves a whiteboard to the trash.
func (s *Service) DeleteWhiteboard(ctx context.Context, ws, actorID, id string) error {
	if err := s.repo.DeleteWhiteboard(ctx, ws, id, actorID); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "whiteboards", "delete", map[string]string{"id": id}, nil)
	return nil
}

func (s *Service) ListTrash(ctx context.Context, ws string) ([]domain.TrashedItem, error) {
	return s.repo.ListTrash(ctx, ws)
}

func validKind(kind string) error {
	if kind != domain.TrashDoc && kind != domain.TrashWhiteboard {
		return apperror.Invalid("invalid_kind", "kind must be doc or whiteboard")
	}
	return nil
}

// Restore brings a trashed doc or whiteboard back and tells every client.
func (s *Service) Restore(ctx context.Context, ws, kind, id string) error {
	if err := validKind(kind); err != nil {
		return err
	}
	if err := s.repo.Restore(ctx, ws, kind, id); err != nil {
		return err
	}
	if kind == domain.TrashWhiteboard {
		w, err := s.repo.GetWhiteboard(ctx, ws, id)
		if err != nil {
			return err
		}
		s.pub.Publish(ctx, ws, "whiteboards", "upsert", w, nil)
		return nil
	}
	d, err := s.repo.GetDoc(ctx, ws, id)
	if err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "docs", "upsert", d, nil)
	return nil
}

func (s *Service) Purge(ctx context.Context, ws, kind, id string) error {
	if err := validKind(kind); err != nil {
		return err
	}
	return s.repo.Purge(ctx, ws, kind, id)
}

func (s *Service) Snapshot(ctx context.Context, ws, _ string) (map[string]any, error) {
	docs, err := s.repo.ListDocs(ctx, ws)
	if err != nil {
		return nil, err
	}
	wbs, err := s.repo.ListWhiteboards(ctx, ws)
	if err != nil {
		return nil, err
	}
	if docs == nil {
		docs = []domain.Doc{}
	}
	if wbs == nil {
		wbs = []domain.Whiteboard{}
	}
	dash, err := s.repo.ListDashboards(ctx, ws)
	if err != nil {
		return nil, err
	}
	return map[string]any{"docs": docs, "whiteboards": wbs, "dashboards": dash}, nil
}

// DashboardCards are the report cards a dashboard can show.
var DashboardCards = map[string]bool{
	"stats": true, "status": true, "workload": true, "trend": true, "priority": true,
	"overdue": true, "dueSoon": true, "recentlyDone": true, "byList": true, "byTag": true,
}

type DashboardInput struct {
	ID        string   `json:"id"`
	ProjectID *string  `json:"projectId"`
	Title     *string  `json:"title"`
	Cards     []string `json:"cards"`
}

// SaveDashboard creates a dashboard or changes its title, scope or cards.
func (s *Service) SaveDashboard(ctx context.Context, ws, actorID, id string, in DashboardInput, create bool) (*domain.Dashboard, error) {
	d := &domain.Dashboard{ID: id, WorkspaceID: ws, CreatedBy: actorID, Title: "Untitled dashboard", Cards: []string{"stats", "status", "workload", "trend"}}
	if !create {
		cur, err := s.repo.GetDashboard(ctx, ws, id)
		if err != nil {
			return nil, err
		}
		d = cur
	}
	if in.Title != nil {
		t := strings.TrimSpace(*in.Title)
		if t == "" || len(t) > 200 {
			return nil, apperror.Invalid("invalid_title", "dashboard title must be 1-200 characters")
		}
		d.Title = t
	}
	if create || in.ProjectID != nil {
		d.ProjectID = in.ProjectID
		if d.ProjectID != nil && *d.ProjectID == "" {
			d.ProjectID = nil
		}
	}
	if in.Cards != nil {
		cards := []string{}
		seen := map[string]bool{}
		for _, c := range in.Cards {
			if DashboardCards[c] && !seen[c] {
				seen[c] = true
				cards = append(cards, c)
			}
		}
		d.Cards = cards
	}
	if err := s.repo.SaveDashboard(ctx, d); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "dashboards", "upsert", d, nil)
	return d, nil
}

func (s *Service) DeleteDashboard(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteDashboard(ctx, ws, id); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "dashboards", "delete", map[string]string{"id": id}, nil)
	return nil
}
