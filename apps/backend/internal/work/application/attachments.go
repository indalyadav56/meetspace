package application

import (
	"context"
	"math"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// ---- comments

// MentionResolver finds users @mentioned by full name in comment text.
type MentionResolver interface {
	Mentioned(ctx context.Context, workspaceID, text string) []string
}

func (s *Service) AddComment(ctx context.Context, ws, actorID, taskID, text string, assignee *string, mentions MentionResolver) (*domain.Comment, error) {
	text = strings.TrimSpace(text)
	if text == "" || len(text) > 10000 {
		return nil, apperror.Invalid("invalid_comment", "comment must be 1-10000 characters")
	}
	t, err := s.repo.GetTask(ctx, ws, taskID)
	if err != nil {
		return nil, err
	}
	if assignee != nil {
		if err := s.requireMembers(ctx, ws, []string{*assignee}); err != nil {
			return nil, err
		}
	}
	c := &domain.Comment{TaskID: taskID, UserID: actorID, Text: text, Assignee: assignee}
	if err := s.repo.CreateComment(ctx, ws, c); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "comments", "upsert", c)

	// Mentioned people and the comment's assignee start watching the task.
	var mentioned []string
	if mentions != nil {
		mentioned = mentions.Mentioned(ctx, ws, text)
	}
	newWatchers := append(append([]string{}, mentioned...), deref(assignee))
	changed := false
	for _, w := range uniq(newWatchers) {
		if w != actorID && !contains(t.Watchers, w) {
			t.Watchers = append(t.Watchers, w)
			changed = true
		}
	}
	if changed {
		if err := s.repo.UpdateTask(ctx, t); err == nil {
			s.emit(ctx, ws, "tasks", "upsert", t)
		}
	}
	preview := text
	if len(preview) > 120 {
		preview = preview[:117] + "…"
	}
	s.notifyAll(ctx, ws, mentioned, "mention", taskID, actorID, "mentioned you: “"+preview+"”", true)
	others := append(append([]string{}, t.Assignees...), t.Watchers...)
	rest := make([]string, 0, len(others))
	for _, o := range others {
		if !contains(mentioned, o) {
			rest = append(rest, o)
		}
	}
	s.notifyAll(ctx, ws, rest, "comment", taskID, actorID, "commented: “"+preview+"”", false)
	if assignee != nil {
		s.logActivity(ctx, ws, taskID, actorID, "assigned a comment to "+s.names.DisplayName(ctx, *assignee))
		s.notifyAll(ctx, ws, []string{*assignee}, "assigned", taskID, actorID, "assigned you a comment", true)
	}
	return c, nil
}

func (s *Service) SetCommentResolved(ctx context.Context, ws, id string, resolved bool) (*domain.Comment, error) {
	c, err := s.repo.GetComment(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	c.Resolved = resolved
	if err := s.repo.UpdateComment(ctx, ws, c); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "comments", "upsert", c)
	return c, nil
}

// ---- custom fields

var fieldTypes = map[string]bool{"text": true, "number": true, "dropdown": true, "checkbox": true, "date": true, "money": true}

func (s *Service) CreateField(ctx context.Context, ws, id, listID, name, typ string) (*domain.CustomField, error) {
	n, err := cleanName(name, 120, "invalid_name")
	if err != nil {
		return nil, err
	}
	if !fieldTypes[typ] {
		return nil, apperror.Invalid("invalid_field_type", "unknown field type")
	}
	if _, err := s.repo.GetList(ctx, ws, listID); err != nil {
		return nil, err
	}
	f := &domain.CustomField{ID: id, ListID: listID, Name: n, Type: typ, Options: []domain.FieldOption{}}
	if err := s.repo.CreateField(ctx, ws, f); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "fields", "upsert", f)
	return f, nil
}

func (s *Service) UpdateField(ctx context.Context, ws, id string, name *string, options *[]domain.FieldOption) (*domain.CustomField, error) {
	f, err := s.repo.GetField(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if name != nil {
		if f.Name, err = cleanName(*name, 120, "invalid_name"); err != nil {
			return nil, err
		}
	}
	if options != nil {
		f.Options = *options
	}
	if err := s.repo.UpdateField(ctx, ws, f); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "fields", "upsert", f)
	return f, nil
}

func (s *Service) DeleteField(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteField(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "fields", id)
	changed, err := s.repo.RemoveCustomValue(ctx, ws, id)
	if err != nil {
		return err
	}
	for i := range changed {
		s.emit(ctx, ws, "tasks", "upsert", &changed[i])
	}
	return nil
}

// ---- time tracking

// StartTimer starts the caller's timer on a task, stopping (and logging) any running one.
func (s *Service) StartTimer(ctx context.Context, ws, userID, taskID string) (*domain.Timer, error) {
	if _, err := s.repo.GetTask(ctx, ws, taskID); err != nil {
		return nil, err
	}
	if cur, _ := s.repo.GetTimer(ctx, ws, userID); cur != nil {
		if _, err := s.StopTimer(ctx, ws, userID); err != nil {
			return nil, err
		}
	}
	t := domain.Timer{TaskID: taskID, Start: s.now().UTC()}
	if err := s.repo.SetTimer(ctx, ws, userID, t); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "timer", "set", t, []string{userID})
	return &t, nil
}

// StopTimer turns the caller's running timer into a time entry (minimum one minute).
func (s *Service) StopTimer(ctx context.Context, ws, userID string) (*domain.TimeEntry, error) {
	t, err := s.repo.GetTimer(ctx, ws, userID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, domain.ErrNoTimer
	}
	// Save the tracked time before removing the timer, so a failure (such as an
	// approved week) leaves the timer running instead of losing the time.
	if err := s.requireOpenWeek(ctx, ws, userID, t.Start); err != nil {
		return nil, apperror.Conflict("timesheet_locked", "the timesheet for the week this timer started in is submitted or approved; reopen it to save this time — the timer keeps running")
	}
	minutes := int(math.Max(1, math.Round(s.now().Sub(t.Start).Minutes())))
	e, err := s.AddTimeEntry(ctx, ws, userID, t.TaskID, t.Start, minutes, "")
	if err != nil {
		return nil, err
	}
	if err := s.repo.DeleteTimer(ctx, ws, userID); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "timer", "clear", nil, []string{userID})
	s.logActivity(ctx, ws, t.TaskID, userID, "tracked "+formatMinutes(minutes))
	return e, nil
}

func formatMinutes(m int) string {
	h := m / 60
	if h == 0 {
		return itoa(m) + "m"
	}
	if m%60 == 0 {
		return itoa(h) + "h"
	}
	return itoa(h) + "h " + itoa(m%60) + "m"
}

func (s *Service) AddTimeEntry(ctx context.Context, ws, userID, taskID string, start time.Time, minutes int, note string) (*domain.TimeEntry, error) {
	if minutes <= 0 || minutes > 24*60 {
		return nil, apperror.Invalid("invalid_duration", "duration must be between 1 minute and 24 hours")
	}
	if _, err := s.repo.GetTask(ctx, ws, taskID); err != nil {
		return nil, err
	}
	if err := s.requireOpenWeek(ctx, ws, userID, start); err != nil {
		return nil, err
	}
	e := &domain.TimeEntry{TaskID: taskID, UserID: userID, Start: start, Duration: minutes, Note: strings.TrimSpace(note)}
	if err := s.repo.CreateTimeEntry(ctx, ws, e); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "timeEntries", "upsert", e)
	return e, nil
}

func (s *Service) UpdateTimeEntry(ctx context.Context, ws, userID, id string, minutes *int, note *string) (*domain.TimeEntry, error) {
	e, err := s.repo.GetTimeEntry(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if e.UserID != userID {
		return nil, apperror.Forbidden("not_your_entry", "you can only edit your own time entries")
	}
	if err := s.requireOpenWeek(ctx, ws, userID, e.Start); err != nil {
		return nil, err
	}
	if minutes != nil {
		if *minutes <= 0 || *minutes > 24*60 {
			return nil, apperror.Invalid("invalid_duration", "duration must be between 1 minute and 24 hours")
		}
		e.Duration = *minutes
	}
	if note != nil {
		e.Note = strings.TrimSpace(*note)
	}
	if err := s.repo.UpdateTimeEntry(ctx, ws, e); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "timeEntries", "upsert", e)
	return e, nil
}

func (s *Service) DeleteTimeEntry(ctx context.Context, ws, userID, id string) error {
	e, err := s.repo.GetTimeEntry(ctx, ws, id)
	if err != nil {
		return err
	}
	if e.UserID != userID {
		return apperror.Forbidden("not_your_entry", "you can only delete your own time entries")
	}
	if err := s.requireOpenWeek(ctx, ws, userID, e.Start); err != nil {
		return err
	}
	if err := s.repo.DeleteTimeEntry(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "timeEntries", id)
	return nil
}

// ---- sprints

func (s *Service) CreateSprint(ctx context.Context, ws, id, projectID string) (*domain.Sprint, error) {
	if _, err := s.repo.GetProject(ctx, ws, projectID); err != nil {
		return nil, err
	}
	all, err := s.repo.ListSprints(ctx, ws)
	if err != nil {
		return nil, err
	}
	start := s.now()
	maxNum := 0
	for _, sp := range all {
		if sp.ProjectID != projectID {
			continue
		}
		if end, err := time.Parse(dateLayout, sp.EndDate); err == nil && !end.Before(start) {
			start = end.AddDate(0, 0, 1)
		}
		var n int
		for _, r := range sp.Name {
			if r >= '0' && r <= '9' {
				n = n*10 + int(r-'0')
			}
		}
		if n > maxNum {
			maxNum = n
		}
	}
	sp := &domain.Sprint{ID: id, ProjectID: projectID, Name: "Sprint " + itoa(maxNum+1), StartDate: start.Format(dateLayout), EndDate: start.AddDate(0, 0, 13).Format(dateLayout), Status: "planned"}
	if err := s.repo.CreateSprint(ctx, ws, sp); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "sprints", "upsert", sp)
	return sp, nil
}

type SprintPatch struct {
	Name      *string `json:"name"`
	Goal      *string `json:"goal"`
	StartDate *string `json:"startDate"`
	EndDate   *string `json:"endDate"`
}

func (s *Service) UpdateSprint(ctx context.Context, ws, id string, p SprintPatch) (*domain.Sprint, error) {
	sp, err := s.repo.GetSprint(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.Name != nil {
		if sp.Name, err = cleanName(*p.Name, 120, "invalid_name"); err != nil {
			return nil, err
		}
	}
	if p.Goal != nil {
		sp.Goal = strings.TrimSpace(*p.Goal)
	}
	if p.StartDate != nil {
		if err := validDate(p.StartDate); err != nil {
			return nil, err
		}
		sp.StartDate = *p.StartDate
	}
	if p.EndDate != nil {
		if err := validDate(p.EndDate); err != nil {
			return nil, err
		}
		sp.EndDate = *p.EndDate
	}
	if sp.EndDate < sp.StartDate {
		return nil, apperror.Invalid("invalid_dates", "sprint must end after it starts")
	}
	if err := s.repo.UpdateSprint(ctx, ws, sp); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "sprints", "upsert", sp)
	return sp, nil
}

func (s *Service) DeleteSprint(ctx context.Context, ws, id string) error {
	sp, err := s.repo.GetSprint(ctx, ws, id)
	if err != nil {
		return err
	}
	if sp.Status == "active" {
		return apperror.Conflict("sprint_active", "complete the sprint before deleting it")
	}
	tasks, err := s.repo.ListTasks(ctx, ws)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteSprint(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "sprints", id)
	// ON DELETE SET NULL cleared sprint_id in the database; push those tasks back to the backlog on clients.
	for i := range tasks {
		if deref(tasks[i].SprintID) == id {
			tasks[i].SprintID = nil
			s.emit(ctx, ws, "tasks", "upsert", &tasks[i])
		}
	}
	return nil
}

// StartSprint activates a sprint; any other active sprint in the project is closed.
func (s *Service) StartSprint(ctx context.Context, ws, id string) (*domain.Sprint, error) {
	sp, err := s.repo.GetSprint(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	all, err := s.repo.ListSprints(ctx, ws)
	if err != nil {
		return nil, err
	}
	for i := range all {
		if all[i].ProjectID == sp.ProjectID && all[i].Status == "active" && all[i].ID != id {
			all[i].Status = "done"
			if err := s.repo.UpdateSprint(ctx, ws, &all[i]); err != nil {
				return nil, err
			}
			s.emit(ctx, ws, "sprints", "upsert", &all[i])
		}
	}
	sp.Status = "active"
	if err := s.repo.UpdateSprint(ctx, ws, sp); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "sprints", "upsert", sp)
	return sp, nil
}

// CompleteSprint records velocity and moves unfinished tasks to moveTo (nil = backlog).
func (s *Service) CompleteSprint(ctx context.Context, ws, actorID, id string, moveTo *string) (*domain.Sprint, error) {
	sp, err := s.repo.GetSprint(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	proj, err := s.repo.GetProject(ctx, ws, sp.ProjectID)
	if err != nil {
		return nil, err
	}
	if moveTo != nil {
		if _, err := s.repo.GetSprint(ctx, ws, *moveTo); err != nil {
			return nil, err
		}
	}
	tasks, err := s.repo.ListTasks(ctx, ws)
	if err != nil {
		return nil, err
	}
	var done float64
	for i := range tasks {
		t := &tasks[i]
		if deref(t.SprintID) != id {
			continue
		}
		st, _ := proj.Status(t.StatusID)
		if st.Finished() {
			done += deref(t.Points)
			continue
		}
		t.SprintID = moveTo
		if err := s.repo.UpdateTask(ctx, t); err != nil {
			return nil, err
		}
		s.emit(ctx, ws, "tasks", "upsert", t)
	}
	sp.Status, sp.CompletedPoints = "done", &done
	if err := s.repo.UpdateSprint(ctx, ws, sp); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "sprints", "upsert", sp)
	if moveTo != nil {
		if _, err := s.StartSprint(ctx, ws, *moveTo); err != nil {
			return nil, err
		}
	}
	return sp, nil
}

// ---- automations

var (
	triggerTypes = map[string]bool{"status_changed": true, "task_created": true, "priority_changed": true, "assignee_added": true}
	actionTypes  = map[string]bool{"set_status": true, "set_priority": true, "add_assignee": true, "add_tag": true, "add_comment": true, "set_due_in": true, "notify": true}
)

func validateAutomation(a *domain.Automation) error {
	if !triggerTypes[a.Trigger.Type] {
		return apperror.Invalid("invalid_trigger", "unknown trigger")
	}
	if len(a.Actions) == 0 || len(a.Actions) > 10 {
		return apperror.Invalid("invalid_actions", "an automation needs 1-10 actions")
	}
	for _, act := range a.Actions {
		if !actionTypes[act.Type] {
			return apperror.Invalid("invalid_actions", "unknown action "+act.Type)
		}
	}
	return nil
}

func (s *Service) CreateAutomation(ctx context.Context, ws string, a domain.Automation) (*domain.Automation, error) {
	if _, err := s.repo.GetProject(ctx, ws, a.ProjectID); err != nil {
		return nil, err
	}
	var err error
	if a.Name, err = cleanName(a.Name, 160, "invalid_name"); err != nil {
		return nil, err
	}
	if err := validateAutomation(&a); err != nil {
		return nil, err
	}
	if err := s.repo.CreateAutomation(ctx, ws, &a); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "automations", "upsert", &a)
	return &a, nil
}

type AutomationPatch struct {
	Name    *string          `json:"name"`
	Enabled *bool            `json:"enabled"`
	Trigger *domain.Trigger  `json:"trigger"`
	Actions *[]domain.Action `json:"actions"`
}

func (s *Service) UpdateAutomation(ctx context.Context, ws, id string, p AutomationPatch) (*domain.Automation, error) {
	a, err := s.repo.GetAutomation(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.Name != nil {
		if a.Name, err = cleanName(*p.Name, 160, "invalid_name"); err != nil {
			return nil, err
		}
	}
	if p.Enabled != nil {
		a.Enabled = *p.Enabled
	}
	if p.Trigger != nil {
		a.Trigger = *p.Trigger
	}
	if p.Actions != nil {
		a.Actions = *p.Actions
	}
	if err := validateAutomation(a); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateAutomation(ctx, ws, a); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "automations", "upsert", a)
	return a, nil
}

func (s *Service) DeleteAutomation(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteAutomation(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "automations", id)
	return nil
}
