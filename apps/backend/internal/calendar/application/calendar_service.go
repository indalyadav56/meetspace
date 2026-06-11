package application

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/calendar/domain"
)

type CalendarService struct {
	repo domain.Repository
	log  *slog.Logger
}

func NewCalendarService(repo domain.Repository, log *slog.Logger) *CalendarService {
	return &CalendarService{repo: repo, log: log}
}

func (s *CalendarService) List(ctx context.Context, f domain.ListFilter) ([]domain.Meeting, error) {
	return s.repo.List(ctx, f)
}

func (s *CalendarService) Get(ctx context.Context, id string) (*domain.Meeting, error) {
	return s.repo.FindByID(ctx, id)
}

type CreateMeetingInput struct {
	Title       string
	Description string
	OrganizerID string
	AttendeeIDs []string
	ChannelID   *string
	StartsAt    time.Time
	EndsAt      time.Time
}

func (s *CalendarService) Create(ctx context.Context, in CreateMeetingInput) (*domain.Meeting, error) {
	if !in.EndsAt.After(in.StartsAt) {
		return nil, domain.ErrInvalidTimeSpan
	}
	m := &domain.Meeting{
		ID:          uuid.NewString(),
		Title:       strings.TrimSpace(in.Title),
		Description: in.Description,
		OrganizerID: in.OrganizerID,
		AttendeeIDs: in.AttendeeIDs,
		ChannelID:   in.ChannelID,
		StartsAt:    in.StartsAt.UTC(),
		EndsAt:      in.EndsAt.UTC(),
		CreatedAt:   time.Now().UTC(),
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}
