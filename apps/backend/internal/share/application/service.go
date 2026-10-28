// Package application creates and resolves public share links.
package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/share/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// Content renders a shared item for a public, read-only page.
type Content interface {
	Public(ctx context.Context, ws, id string) (map[string]any, error)
}

// Access checks the person creating a link can see the item (private Spaces).
type Access func(ctx context.Context, ws, user, kind, id string) error

type Service struct {
	repo    domain.Repository
	content map[string]Content
	access  Access
	now     func() time.Time
}

func NewService(repo domain.Repository, content map[string]Content, access Access) *Service {
	return &Service{repo: repo, content: content, access: access, now: time.Now}
}

func token() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Enable turns on the item's link (reusing an existing one) and sets its expiry.
func (s *Service) Enable(ctx context.Context, ws, actor, kind, id string, expires *time.Time) (*domain.Link, error) {
	if !domain.Kinds[kind] {
		return nil, domain.ErrInvalidKind
	}
	if expires != nil && !expires.After(s.now()) {
		return nil, apperror.Invalid("invalid_expiry", "pick an expiry date in the future")
	}
	if err := s.access(ctx, ws, actor, kind, id); err != nil {
		return nil, err
	}
	// Make sure the item exists before handing out a link.
	if _, err := s.content[kind].Public(ctx, ws, id); err != nil {
		return nil, err
	}
	if l, err := s.repo.Active(ctx, ws, kind, id); err == nil {
		if err := s.repo.SetExpiry(ctx, ws, l.ID, expires); err != nil {
			return nil, err
		}
		l.ExpiresAt = expires
		return l, nil
	}
	tok, err := token()
	if err != nil {
		return nil, err
	}
	l := &domain.Link{WorkspaceID: ws, Kind: kind, EntityID: id, Token: tok, CreatedBy: &actor, ExpiresAt: expires}
	return l, s.repo.Create(ctx, l)
}

// Get returns the item's active link, or ErrNotFound.
func (s *Service) Get(ctx context.Context, ws, actor, kind, id string) (*domain.Link, error) {
	if err := s.access(ctx, ws, actor, kind, id); err != nil {
		return nil, err
	}
	return s.repo.Active(ctx, ws, kind, id)
}

// Disable turns the link off for good; enabling again makes a new URL.
func (s *Service) Disable(ctx context.Context, ws, actor, kind, id string) error {
	l, err := s.Get(ctx, ws, actor, kind, id)
	if err != nil {
		return err
	}
	return s.repo.Revoke(ctx, ws, l.ID)
}

func (s *Service) List(ctx context.Context, ws string) ([]domain.Link, error) { return s.repo.ForWorkspace(ctx, ws) }

// Open resolves a token for the public page and counts the view.
func (s *Service) Open(ctx context.Context, tok string) (map[string]any, error) {
	if len(tok) < 16 || len(tok) > 40 {
		return nil, domain.ErrNotFound
	}
	l, err := s.repo.ByToken(ctx, tok)
	if err != nil {
		return nil, err
	}
	if l.ExpiresAt != nil && s.now().After(*l.ExpiresAt) {
		return nil, domain.ErrExpired
	}
	out, err := s.content[l.Kind].Public(ctx, l.WorkspaceID, l.EntityID)
	if err != nil {
		// The item was deleted; the link stops working with it.
		return nil, domain.ErrNotFound
	}
	_ = s.repo.CountView(ctx, l.ID)
	out["kind"] = l.Kind
	return out, nil
}
