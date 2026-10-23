package application

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// Timesheets are weekly (Monday–Sunday). A person submits their week; an owner
// or admin approves it or sends it back. Submitted and approved weeks are locked.

// weekOf returns the Monday (YYYY-MM-DD) of the week containing t, in UTC.
func weekOf(t time.Time) string {
	t = t.UTC()
	return t.AddDate(0, 0, -((int(t.Weekday()) + 6) % 7)).Format(dateLayout)
}

func parseWeek(s string) (string, error) {
	d, err := time.Parse(dateLayout, s)
	if err != nil || d.Weekday() != time.Monday {
		return "", apperror.Invalid("invalid_week", "weekStart must be a Monday (YYYY-MM-DD)")
	}
	return s, nil
}

func (s *Service) requireOpenWeek(ctx context.Context, ws, userID string, at time.Time) error {
	t, err := s.repo.GetTimesheet(ctx, ws, userID, weekOf(at))
	if err != nil {
		return err
	}
	if t != nil && t.Locked() {
		return domain.ErrTimesheetLocked
	}
	return nil
}

func (s *Service) sheet(ctx context.Context, ws, userID, week string) (*domain.Timesheet, error) {
	t, err := s.repo.GetTimesheet(ctx, ws, userID, week)
	if err != nil {
		return nil, err
	}
	if t == nil {
		t = &domain.Timesheet{UserID: userID, WeekStart: week, Status: "open"}
	}
	return t, nil
}

func (s *Service) saveSheet(ctx context.Context, ws string, t *domain.Timesheet) error {
	if err := s.repo.SaveTimesheet(ctx, ws, t); err != nil {
		return err
	}
	s.emit(ctx, ws, "timesheets", "upsert", t)
	return nil
}

func weekLabel(week string) string {
	d, _ := time.Parse(dateLayout, week)
	return "the week of " + d.Format("Jan 2")
}

// SubmitTimesheet sends the actor's week for approval.
func (s *Service) SubmitTimesheet(ctx context.Context, ws, actorID, week string) (*domain.Timesheet, error) {
	week, err := parseWeek(week)
	if err != nil {
		return nil, err
	}
	t, err := s.sheet(ctx, ws, actorID, week)
	if err != nil {
		return nil, err
	}
	if t.Status == "approved" {
		return nil, apperror.Conflict("already_approved", "this timesheet is already approved")
	}
	now := s.now().UTC()
	t.Status, t.SubmittedAt, t.DecidedBy, t.DecidedAt = "submitted", &now, nil, nil
	if err := s.saveSheet(ctx, ws, t); err != nil {
		return nil, err
	}
	// Tell everyone who can approve it.
	ids, err := s.members.MemberIDs(ctx, ws)
	if err == nil {
		var managers []string
		for _, id := range ids {
			if ok, _ := s.members.CanManage(ctx, ws, id); ok && id != actorID {
				managers = append(managers, id)
			}
		}
		s.notifyAll(ctx, ws, managers, "timesheet", "", actorID, s.names.DisplayName(ctx, actorID)+" submitted their timesheet for "+weekLabel(week), true)
	}
	return t, nil
}

// DecideTimesheet approves a submitted week or sends it back with a note.
func (s *Service) DecideTimesheet(ctx context.Context, ws, actorID, userID, week string, approve bool, note string) (*domain.Timesheet, error) {
	if ok, err := s.members.CanManage(ctx, ws, actorID); err != nil {
		return nil, err
	} else if !ok {
		return nil, apperror.Forbidden("not_a_manager", "only owners and admins can approve timesheets")
	}
	week, err := parseWeek(week)
	if err != nil {
		return nil, err
	}
	t, err := s.sheet(ctx, ws, userID, week)
	if err != nil {
		return nil, err
	}
	if t.Status != "submitted" {
		return nil, apperror.Conflict("not_submitted", "only submitted timesheets can be approved or returned")
	}
	now := s.now().UTC()
	t.DecidedBy, t.DecidedAt, t.Note = &actorID, &now, note
	text := s.names.DisplayName(ctx, actorID) + " approved your timesheet for " + weekLabel(week)
	if approve {
		t.Status = "approved"
	} else {
		t.Status = "rejected"
		text = s.names.DisplayName(ctx, actorID) + " returned your timesheet for " + weekLabel(week)
		if note != "" {
			text += ": " + note
		}
	}
	if err := s.saveSheet(ctx, ws, t); err != nil {
		return nil, err
	}
	s.notifyAll(ctx, ws, []string{userID}, "timesheet", "", actorID, text, !approve)
	return t, nil
}

// ReopenTimesheet unlocks a week. People can pull back their own submission;
// owners and admins can reopen any week, including approved ones.
func (s *Service) ReopenTimesheet(ctx context.Context, ws, actorID, userID, week string) (*domain.Timesheet, error) {
	week, err := parseWeek(week)
	if err != nil {
		return nil, err
	}
	t, err := s.sheet(ctx, ws, userID, week)
	if err != nil {
		return nil, err
	}
	manager, err := s.members.CanManage(ctx, ws, actorID)
	if err != nil {
		return nil, err
	}
	if !manager && (actorID != userID || t.Status == "approved") {
		return nil, apperror.Forbidden("cannot_reopen", "ask an owner or admin to reopen an approved timesheet")
	}
	t.Status, t.SubmittedAt, t.DecidedBy, t.DecidedAt = "open", nil, nil, nil
	if err := s.saveSheet(ctx, ws, t); err != nil {
		return nil, err
	}
	return t, nil
}
