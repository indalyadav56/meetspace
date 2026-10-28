package application

import (
	"context"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

const maxSaved = 50

// SavedSearches keeps each person's named searches per workspace.
type SavedSearches struct{ repo domain.SavedRepository }

func NewSavedSearches(repo domain.SavedRepository) *SavedSearches { return &SavedSearches{repo: repo} }

func (s *SavedSearches) List(ctx context.Context, ws, user string) ([]domain.SavedSearch, error) {
	return s.repo.List(ctx, ws, user)
}

func (s *SavedSearches) Save(ctx context.Context, ws, user, name string, query map[string]any) (*domain.SavedSearch, error) {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > 80 {
		return nil, apperror.Invalid("invalid_name", "give the search a name (up to 80 characters)")
	}
	if q, _ := query["q"].(string); strings.TrimSpace(q) == "" {
		return nil, domain.ErrEmptyQuery
	}
	existing, err := s.repo.List(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	if len(existing) >= maxSaved {
		return nil, apperror.Invalid("too_many_saved", "you can keep up to 50 saved searches")
	}
	out := &domain.SavedSearch{Name: name, Query: query}
	return out, s.repo.Save(ctx, ws, user, out)
}

func (s *SavedSearches) Delete(ctx context.Context, ws, user, id string) error {
	return s.repo.Delete(ctx, ws, user, id)
}
