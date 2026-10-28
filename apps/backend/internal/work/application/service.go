// Package application implements the work context's use cases.
package application

import (
	"context"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Service struct {
	repo    domain.Repository
	pub     Publisher
	notify  Notifier
	members Members
	keys    KeyAllocator
	names   UserNames
	log     *zap.Logger
	now     func() time.Time
	triager Triager // optional: powers the "AI triage" automation action
}

func NewService(repo domain.Repository, pub Publisher, notify Notifier, members Members, keys KeyAllocator, names UserNames, log *zap.Logger) *Service {
	return &Service{repo: repo, pub: pub, notify: notify, members: members, keys: keys, names: names, log: log, now: time.Now}
}

// emit publishes a change to everyone who can see the Space it belongs to.
func (s *Service) emit(ctx context.Context, ws, collection, op string, v any) {
	s.pub.Publish(ctx, ws, collection, op, v, s.audience(ctx, ws, v))
}

func (s *Service) deleted(ctx context.Context, ws, collection, id string) {
	s.pub.Publish(ctx, ws, collection, "delete", map[string]string{"id": id}, nil)
}

// logActivity records and publishes one activity line. Failures are logged
// rather than returned: activity is a side record and must not fail the write.
func (s *Service) logActivity(ctx context.Context, ws, taskID, actorID, text string) {
	a := &domain.Activity{TaskID: taskID, UserID: actorID, Text: text}
	if err := s.repo.CreateActivity(ctx, ws, a); err != nil {
		s.log.Warn("activity insert failed", zap.Error(err))
		return
	}
	s.emit(ctx, ws, "activity", "upsert", a)
}

// notifyAll notifies each distinct recipient; Notifier skips the actor.
func (s *Service) notifyAll(ctx context.Context, ws string, recipients []string, kind, taskID, actorID, text string, important bool) {
	seen := map[string]bool{}
	for _, r := range recipients {
		if r == "" || seen[r] {
			continue
		}
		seen[r] = true
		if err := s.notify.Notify(ctx, ws, r, kind, taskID, actorID, text, important); err != nil {
			s.log.Warn("notify failed", zap.Error(err))
		}
	}
}

func (s *Service) requireMembers(ctx context.Context, ws string, ids []string) error {
	for _, id := range ids {
		ok, err := s.members.IsMember(ctx, ws, id)
		if err != nil {
			return err
		}
		if !ok {
			return domain.ErrNotMember
		}
	}
	return nil
}

func cleanName(n string, max int, code string) (string, error) {
	n = strings.TrimSpace(n)
	if n == "" || len(n) > max {
		return "", apperror.Invalid(code, "name must be 1-"+itoa(max)+" characters")
	}
	return n, nil
}

func itoa(i int) string {
	if i < 10 {
		return string(rune('0' + i))
	}
	return itoa(i/10) + string(rune('0'+i%10))
}

func uniq(xs []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(xs))
	for _, x := range xs {
		if x != "" && !seen[x] {
			seen[x] = true
			out = append(out, x)
		}
	}
	return out
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

// projectOfTask resolves the project (and thus statuses) a task belongs to.
func (s *Service) projectOfTask(ctx context.Context, t *domain.Task) (*domain.Project, error) {
	l, err := s.repo.GetList(ctx, t.WorkspaceID, t.ListID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetProject(ctx, t.WorkspaceID, l.ProjectID)
}
