// Package application builds per-person calendar feeds of due tasks and meetings.
package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
	"github.com/indalyadav56/meetspace/backend/pkg/ical"
)

// TaskItem is a task with a due date that belongs to the person.
type TaskItem struct {
	ID, Title, List string
	Key             int64
	Start, Due      string // YYYY-MM-DD; Start may be empty
	UpdatedAt       time.Time
}

// MeetingItem is a meeting the person is invited to.
type MeetingItem struct {
	ID, Title, Agenda string
	Start             time.Time
	DurationMin       int
}

type Source interface {
	OpenTasks(ctx context.Context, ws, user string) ([]TaskItem, error)
	Meetings(ctx context.Context, ws, user string) ([]MeetingItem, error)
	WorkspaceName(ctx context.Context, ws string) string
}

type Repository interface {
	Token(ctx context.Context, ws, user string) (string, error)
	Save(ctx context.Context, ws, user, token string) error
	Delete(ctx context.Context, ws, user string) error
	Resolve(ctx context.Context, token string) (ws, user string, err error)
}

var ErrNotFound = apperror.NotFound("feed_not_found", "this calendar feed was turned off")

type Service struct {
	repo   Repository
	src    Source
	webURL string
	now    func() time.Time
}

func NewService(repo Repository, src Source, webURL string) *Service {
	return &Service{repo: repo, src: src, webURL: strings.TrimRight(webURL, "/"), now: time.Now}
}

func newToken() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Enable returns the person's feed token, creating it the first time (or anew when rotating).
func (s *Service) Enable(ctx context.Context, ws, user string, rotate bool) (string, error) {
	if !rotate {
		if tok, err := s.repo.Token(ctx, ws, user); err == nil {
			return tok, nil
		}
	}
	tok, err := newToken()
	if err != nil {
		return "", err
	}
	return tok, s.repo.Save(ctx, ws, user, tok)
}

func (s *Service) Current(ctx context.Context, ws, user string) (string, error) {
	return s.repo.Token(ctx, ws, user)
}

func (s *Service) Disable(ctx context.Context, ws, user string) error {
	return s.repo.Delete(ctx, ws, user)
}

// Feed renders the calendar for a token: open tasks due from a month back on, and
// meetings from a month back to a year ahead.
func (s *Service) Feed(ctx context.Context, token string) (string, error) {
	ws, user, err := s.repo.Resolve(ctx, token)
	if err != nil {
		return "", err
	}
	now := s.now()
	var events []ical.Event
	tasks, err := s.src.OpenTasks(ctx, ws, user)
	if err != nil {
		return "", err
	}
	horizon := now.AddDate(0, -1, 0).Format("2006-01-02")
	for _, t := range tasks {
		if t.Due < horizon {
			continue
		}
		due, err := time.Parse("2006-01-02", t.Due)
		if err != nil {
			continue
		}
		start := due
		if t.Start != "" {
			if st, err := time.Parse("2006-01-02", t.Start); err == nil && !st.After(due) && due.Sub(st) < 60*24*time.Hour {
				start = st
			}
		}
		events = append(events, ical.Event{
			UID: "task-" + t.ID + "@meetspace", Summary: fmt.Sprintf("MS-%d %s", t.Key, t.Title), AllDay: true,
			Start: start, End: due.AddDate(0, 0, 1), Description: "In " + t.List + "\n" + s.webURL + "/app/t/" + t.ID,
			URL: s.webURL + "/app/t/" + t.ID, Updated: t.UpdatedAt,
		})
	}
	meetings, err := s.src.Meetings(ctx, ws, user)
	if err != nil {
		return "", err
	}
	for _, m := range meetings {
		if m.Start.Before(now.AddDate(0, -1, 0)) || m.Start.After(now.AddDate(1, 0, 0)) {
			continue
		}
		dur := m.DurationMin
		if dur <= 0 {
			dur = 30
		}
		events = append(events, ical.Event{
			UID: "meeting-" + m.ID + "@meetspace", Summary: m.Title, Start: m.Start, End: m.Start.Add(time.Duration(dur) * time.Minute),
			Description: strings.TrimSpace(m.Agenda + "\n\nJoin in Meetspace: " + s.webURL + "/app/meetings"), URL: s.webURL + "/app/meetings",
		})
	}
	return ical.Calendar("Meetspace · "+s.src.WorkspaceName(ctx, ws), events, now), nil
}
