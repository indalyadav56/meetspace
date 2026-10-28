// Package application records and lists audit events.
package application

import (
	"context"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/audit/domain"
)

// Retention is how long audit events are kept.
const Retention = 365 * 24 * time.Hour

type Service struct {
	repo domain.Repository
	log  *zap.Logger
	q    chan domain.Event
}

// NewService starts a small background writer so recording never slows a request.
func NewService(repo domain.Repository, log *zap.Logger) *Service {
	s := &Service{repo: repo, log: log, q: make(chan domain.Event, 1024)}
	go s.drain()
	return s
}

func (s *Service) drain() {
	for e := range s.q {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := s.repo.Insert(ctx, &e); err != nil {
			s.log.Warn("audit write failed", zap.String("action", e.Action), zap.Error(err))
		}
		cancel()
	}
}

// Record queues an event. If the queue is full the event is written inline
// rather than dropped: the audit trail must be complete.
func (s *Service) Record(e domain.Event) {
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}
	e.Summary = clip(e.Summary, 300)
	e.UserAgent = clip(e.UserAgent, 300)
	select {
	case s.q <- e:
	default:
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.repo.Insert(ctx, &e); err != nil {
			s.log.Warn("audit write failed", zap.String("action", e.Action), zap.Error(err))
		}
	}
}

// Security records an account-level event (no workspace).
func (s *Service) Security(userID, action, ip, ua string, meta map[string]any) {
	var actor *string
	if userID != "" {
		actor = &userID
	}
	s.Record(domain.Event{ActorID: actor, Action: action, EntityType: "account", EntityID: userID, IP: ip, UserAgent: ua, Meta: meta})
}

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len([]rune(s)) <= n {
		return s
	}
	return string([]rune(s)[:n-1]) + "…"
}

// List returns a page of a workspace's events; callers must be owners or admins.
func (s *Service) List(ctx context.Context, role string, f domain.Filter) ([]domain.Event, error) {
	if role != "owner" && role != "admin" {
		return nil, domain.ErrForbidden
	}
	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 100
	}
	return s.repo.List(ctx, f)
}

// Mine lists the caller's own account-level events (sign-ins, 2FA, password).
func (s *Service) Mine(ctx context.Context, userID string, limit int) ([]domain.Event, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.repo.List(ctx, domain.Filter{ActorID: userID, Limit: limit, Action: "auth."})
}

func (s *Service) Actions(ctx context.Context, role, workspaceID string) ([]string, error) {
	if role != "owner" && role != "admin" {
		return nil, domain.ErrForbidden
	}
	return s.repo.Actions(ctx, workspaceID)
}

// Purge drops events older than Retention; the worker runs it daily.
func (s *Service) Purge(ctx context.Context) (int64, error) {
	return s.repo.Purge(ctx, time.Now().Add(-Retention))
}
