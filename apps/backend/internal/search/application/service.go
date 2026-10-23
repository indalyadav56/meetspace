// Package application keeps the search index in step with the rest of the app
// and answers queries.
package application

import (
	"context"
	"encoding/json"
	"strings"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
)

type Service struct {
	index domain.Index // nil when search isn't configured
	log   *zap.Logger
}

func NewService(index domain.Index, log *zap.Logger) *Service {
	return &Service{index: index, log: log}
}

func (s *Service) Enabled() bool { return s.index != nil }

// Search runs a query scoped to the workspace and to what the user may see.
func (s *Service) Search(ctx context.Context, q domain.Query) (*domain.Results, error) {
	if s.index == nil {
		return nil, domain.ErrUnavailable
	}
	q.Text = strings.TrimSpace(q.Text)
	if q.Text == "" {
		return nil, domain.ErrEmptyQuery
	}
	if q.Limit <= 0 || q.Limit > 50 {
		q.Limit = 20
	}
	if q.Sort != "recent" {
		q.Sort = "relevance"
	}
	return s.index.Search(ctx, q)
}

// Apply indexes one change (an upsert or delete from another context).
func (s *Service) Apply(ctx context.Context, c Change) error {
	if s.index == nil {
		return nil
	}
	if c.Collection == "workspaces" && c.Op == "delete" {
		return s.index.DeleteWorkspace(ctx, c.WorkspaceID)
	}
	if !Indexed(c.Collection) {
		return nil
	}
	if c.Op == "delete" {
		var p struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(c.Payload, &p); err != nil || p.ID == "" {
			return nil
		}
		return s.index.Delete(ctx, collectionTypes[c.Collection]+":"+p.ID)
	}
	if c.Op != "upsert" {
		return nil
	}
	doc, ok := toDocument(c)
	if !ok {
		return nil
	}
	return s.index.Upsert(ctx, doc)
}

// ApplyEvent indexes a raw realtime event as published on the bus.
func (s *Service) ApplyEvent(ctx context.Context, data []byte) {
	var ev struct {
		WorkspaceID string          `json:"workspaceId"`
		Collection  string          `json:"collection"`
		Op          string          `json:"op"`
		Payload     json.RawMessage `json:"payload"`
		Audience    []string        `json:"audience"`
	}
	if err := json.Unmarshal(data, &ev); err != nil {
		return
	}
	if err := s.Apply(ctx, Change{WorkspaceID: ev.WorkspaceID, Collection: ev.Collection, Op: ev.Op, Payload: ev.Payload, Audience: ev.Audience}); err != nil {
		s.log.Warn("search indexing failed", zap.String("collection", ev.Collection), zap.Error(err))
	}
}

// Reindex replaces a workspace's documents with the given items.
func (s *Service) Reindex(ctx context.Context, workspaceID string, items []Change) (int, error) {
	if s.index == nil {
		return 0, domain.ErrUnavailable
	}
	if err := s.index.DeleteWorkspace(ctx, workspaceID); err != nil {
		return 0, err
	}
	docs := make([]domain.Document, 0, len(items))
	for _, c := range items {
		c.WorkspaceID = workspaceID
		if d, ok := toDocument(c); ok {
			docs = append(docs, d)
		}
	}
	for start := 0; start < len(docs); start += 500 {
		end := min(start+500, len(docs))
		if err := s.index.Upsert(ctx, docs[start:end]...); err != nil {
			return start, err
		}
	}
	return len(docs), nil
}
