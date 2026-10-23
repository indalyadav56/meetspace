// Package application implements notification and reminder use cases.
package application

import (
	"context"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
)

type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

type Service struct {
	repo domain.Repository
	pub  Publisher
	now  func() time.Time
}

func NewService(repo domain.Repository, pub Publisher) *Service {
	return &Service{repo: repo, pub: pub, now: time.Now}
}

// Notify records a notification for recipient and pushes it to them. Actors
// are never notified about their own actions.
func (s *Service) Notify(ctx context.Context, workspaceID, recipientID, kind, taskID, actorID, text string, important bool) error {
	if recipientID == "" || recipientID == actorID {
		return nil
	}
	n := &domain.Notification{WorkspaceID: workspaceID, UserID: recipientID, Kind: kind, TaskID: taskID, ActorID: actorID, Text: text, Important: important}
	if err := s.repo.CreateNotification(ctx, n); err != nil {
		return err
	}
	s.pub.Publish(ctx, workspaceID, "notifications", "upsert", n, []string{recipientID})
	return nil
}

func (s *Service) Update(ctx context.Context, workspaceID, userID, id string, read, cleared *bool) (*domain.Notification, error) {
	n, err := s.repo.UpdateNotification(ctx, id, userID, read, cleared)
	if err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, workspaceID, "notifications", "upsert", n, []string{userID})
	return n, nil
}

func (s *Service) MarkAllRead(ctx context.Context, workspaceID, userID string) error {
	if err := s.repo.MarkAllRead(ctx, workspaceID, userID); err != nil {
		return err
	}
	s.pub.Publish(ctx, workspaceID, "notifications", "allRead", map[string]bool{"read": true}, []string{userID})
	return nil
}

func cleanText(t string) (string, error) {
	t = strings.TrimSpace(t)
	if t == "" || len(t) > 500 {
		return "", domain.ErrInvalidText
	}
	return t, nil
}

func (s *Service) CreateReminder(ctx context.Context, workspaceID, userID, id, text string, due time.Time, taskID *string) (*domain.Reminder, error) {
	t, err := cleanText(text)
	if err != nil {
		return nil, err
	}
	r := &domain.Reminder{ID: id, WorkspaceID: workspaceID, UserID: userID, Text: t, Due: due, TaskID: taskID}
	if err := s.repo.CreateReminder(ctx, r); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, workspaceID, "reminders", "upsert", r, []string{userID})
	return r, nil
}

type ReminderPatch struct {
	Text *string
	Due  *time.Time
	Done *bool
}

func (s *Service) UpdateReminder(ctx context.Context, workspaceID, userID, id string, p ReminderPatch) (*domain.Reminder, error) {
	r, err := s.repo.GetReminder(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if p.Text != nil {
		if r.Text, err = cleanText(*p.Text); err != nil {
			return nil, err
		}
	}
	if p.Due != nil {
		r.Due = *p.Due
		r.Notified = false // rescheduling re-arms it
	}
	if p.Done != nil {
		r.Done = *p.Done
	}
	if err := s.repo.UpdateReminder(ctx, r); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, workspaceID, "reminders", "upsert", r, []string{userID})
	return r, nil
}

func (s *Service) DeleteReminder(ctx context.Context, workspaceID, userID, id string) error {
	if err := s.repo.DeleteReminder(ctx, id, userID); err != nil {
		return err
	}
	s.pub.Publish(ctx, workspaceID, "reminders", "delete", map[string]string{"id": id}, []string{userID})
	return nil
}

// FireDue turns due reminders into notifications. Run periodically by the worker.
func (s *Service) FireDue(ctx context.Context) (int, error) {
	due, err := s.repo.ClaimDue(ctx, s.now(), 200)
	if err != nil {
		return 0, err
	}
	for _, r := range due {
		taskID := ""
		if r.TaskID != nil {
			taskID = *r.TaskID
		}
		n := &domain.Notification{WorkspaceID: r.WorkspaceID, UserID: r.UserID, Kind: "reminder", TaskID: taskID, ActorID: r.UserID, Text: r.Text, Important: true}
		if err := s.repo.CreateNotification(ctx, n); err != nil {
			return 0, err
		}
		s.pub.Publish(ctx, r.WorkspaceID, "notifications", "upsert", n, []string{r.UserID})
		s.pub.Publish(ctx, r.WorkspaceID, "reminders", "upsert", r, []string{r.UserID})
	}
	return len(due), nil
}

// Snapshot returns the caller's notifications and reminders.
func (s *Service) Snapshot(ctx context.Context, workspaceID, userID string) (map[string]any, error) {
	ns, err := s.repo.ListNotifications(ctx, workspaceID, userID, 200)
	if err != nil {
		return nil, err
	}
	rs, err := s.repo.ListReminders(ctx, workspaceID, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"notifications": nonNil(ns), "reminders": nonNil(rs)}, nil
}

func nonNil[T any](xs []T) []T {
	if xs == nil {
		return []T{}
	}
	return xs
}
