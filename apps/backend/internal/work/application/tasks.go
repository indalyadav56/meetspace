package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
	"github.com/indalyadav56/meetspace/backend/pkg/optional"
)

const dateLayout = "2006-01-02"

var (
	validPriorities  = map[string]bool{"urgent": true, "high": true, "normal": true, "low": true}
	validRecurrences = map[string]bool{"daily": true, "weekly": true, "monthly": true}
)

// TaskInput creates a task. Empty StatusID means the project's first status.
type TaskInput struct {
	ID          string                 `json:"id"` // optional client-generated id
	ListID      string                 `json:"listId"`
	ParentID    *string                `json:"parentId"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	StatusID    string                 `json:"statusId"`
	Priority    *string                `json:"priority"`
	Assignees   []string               `json:"assignees"`
	Tags        []string               `json:"tags"`
	StartDate   *string                `json:"startDate"`
	DueDate     *string                `json:"dueDate"`
	Estimate    *float64               `json:"estimate"`
	Checklist   []domain.ChecklistItem `json:"checklist"`
	Recurrence  *string                `json:"recurrence"`
	Custom      map[string]any         `json:"custom"`
	SprintID    *string                `json:"sprintId"`
	Points      *float64               `json:"points"`
}

// TaskPatch is a partial update; absent fields are untouched and JSON null clears.
type TaskPatch struct {
	ListID      optional.Field[string]                 `json:"listId"`
	Title       optional.Field[string]                 `json:"title"`
	Description optional.Field[string]                 `json:"description"`
	StatusID    optional.Field[string]                 `json:"statusId"`
	Priority    optional.Field[string]                 `json:"priority"`
	Assignees   optional.Field[[]string]               `json:"assignees"`
	Tags        optional.Field[[]string]               `json:"tags"`
	StartDate   optional.Field[string]                 `json:"startDate"`
	DueDate     optional.Field[string]                 `json:"dueDate"`
	Estimate    optional.Field[float64]                `json:"estimate"`
	Checklist   optional.Field[[]domain.ChecklistItem] `json:"checklist"`
	Recurrence  optional.Field[string]                 `json:"recurrence"`
	// Custom is merged key by key; a null value removes that key.
	Custom   optional.Field[map[string]any] `json:"custom"`
	SprintID optional.Field[string]         `json:"sprintId"`
	Points   optional.Field[float64]        `json:"points"`
	Watchers optional.Field[[]string]       `json:"watchers"`
	ClipIDs  optional.Field[[]string]       `json:"clipIds"`
	Order    optional.Field[float64]        `json:"order"`
}

func validDate(v *string) error {
	if v == nil {
		return nil
	}
	if _, err := time.Parse(dateLayout, *v); err != nil {
		return apperror.Invalid("invalid_date", "dates must be YYYY-MM-DD")
	}
	return nil
}

func cleanTitle(t string) (string, error) {
	t = strings.TrimSpace(t)
	if t == "" || len(t) > 500 {
		return "", apperror.Invalid("invalid_title", "title must be 1-500 characters")
	}
	return t, nil
}

func cleanTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		t = strings.ToLower(strings.TrimSpace(t))
		if t != "" && len(t) <= 40 && !contains(out, t) {
			out = append(out, t)
		}
	}
	return out
}

func (s *Service) CreateTask(ctx context.Context, ws, actorID string, in TaskInput) (*domain.Task, error) {
	title, err := cleanTitle(in.Title)
	if err != nil {
		return nil, err
	}
	list, err := s.repo.GetList(ctx, ws, in.ListID)
	if err != nil {
		return nil, err
	}
	proj, err := s.repo.GetProject(ctx, ws, list.ProjectID)
	if err != nil {
		return nil, err
	}
	status := proj.Statuses[0].ID
	if in.StatusID != "" {
		if _, ok := proj.Status(in.StatusID); !ok {
			return nil, domain.ErrInvalidStatus
		}
		status = in.StatusID
	}
	if in.ParentID != nil {
		parent, err := s.repo.GetTask(ctx, ws, *in.ParentID)
		if err != nil {
			return nil, err
		}
		in.ListID = parent.ListID
	}
	if in.Priority != nil && !validPriorities[*in.Priority] {
		return nil, apperror.Invalid("invalid_priority", "priority must be urgent, high, normal or low")
	}
	if in.Recurrence != nil && !validRecurrences[*in.Recurrence] {
		return nil, apperror.Invalid("invalid_recurrence", "recurrence must be daily, weekly or monthly")
	}
	if err := validDate(in.StartDate); err != nil {
		return nil, err
	}
	if err := validDate(in.DueDate); err != nil {
		return nil, err
	}
	assignees := uniq(in.Assignees)
	if err := s.requireMembers(ctx, ws, assignees); err != nil {
		return nil, err
	}
	key, err := s.keys.NextTaskKey(ctx, ws)
	if err != nil {
		return nil, err
	}
	maxOrder, err := s.repo.MaxOrder(ctx, ws)
	if err != nil {
		return nil, err
	}
	var createdBy *string
	if actorID != "" && actorID != domain.BotID {
		createdBy = &actorID
	}
	checklist := in.Checklist
	for i := range checklist {
		if checklist[i].ID == "" {
			checklist[i].ID = uuid.NewString()
		}
	}
	t := &domain.Task{
		ID:          in.ID,
		WorkspaceID: ws, Key: key, ListID: in.ListID, ParentID: in.ParentID, Title: title, Description: in.Description,
		StatusID: status, Priority: in.Priority, Assignees: assignees, Tags: cleanTags(in.Tags), StartDate: in.StartDate,
		DueDate: in.DueDate, Estimate: in.Estimate, Checklist: checklist, Recurrence: in.Recurrence, Custom: in.Custom,
		SprintID: in.SprintID, Points: in.Points, Order: maxOrder + 1, CreatedBy: createdBy,
	}
	if err := s.repo.CreateTask(ctx, t); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "tasks", "upsert", t)
	s.logActivity(ctx, ws, t.ID, actorID, "created this task")
	s.notifyAll(ctx, ws, assignees, "assigned", t.ID, actorID, "assigned you to this task", true)
	s.runAutomations(ctx, t, proj, actorID, "task_created", "", 0)
	return t, nil
}

func (s *Service) GetTask(ctx context.Context, ws, id string) (*domain.Task, error) {
	return s.repo.GetTask(ctx, ws, id)
}

// UpdateTask applies a patch and its side effects: activity, notifications,
// recurrence and automations.
func (s *Service) UpdateTask(ctx context.Context, ws, actorID, id string, p TaskPatch) (*domain.Task, error) {
	t, err := s.repo.GetTask(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	prev := *t
	prev.Assignees = append([]string(nil), t.Assignees...)
	proj, err := s.projectOfTask(ctx, t)
	if err != nil {
		return nil, err
	}

	if p.ListID.Set && p.ListID.Value != nil && *p.ListID.Value != t.ListID {
		nl, err := s.repo.GetList(ctx, ws, *p.ListID.Value)
		if err != nil {
			return nil, err
		}
		t.ListID = nl.ID
		if nl.ProjectID != proj.ID {
			// Moving across projects: map the status by type into the new project.
			np, err := s.repo.GetProject(ctx, ws, nl.ProjectID)
			if err != nil {
				return nil, err
			}
			cur, _ := proj.Status(t.StatusID)
			t.StatusID = np.FirstOfType(cur.Type).ID
			proj = np
		}
	}
	if p.Title.Set {
		if p.Title.Value == nil {
			return nil, apperror.Invalid("invalid_title", "title can't be empty")
		}
		if t.Title, err = cleanTitle(*p.Title.Value); err != nil {
			return nil, err
		}
	}
	if p.Description.Set {
		t.Description = deref(p.Description.Value)
	}
	if p.StatusID.Set && p.StatusID.Value != nil {
		if _, ok := proj.Status(*p.StatusID.Value); !ok {
			return nil, domain.ErrInvalidStatus
		}
		t.StatusID = *p.StatusID.Value
	}
	if p.Priority.Set {
		if p.Priority.Value != nil && !validPriorities[*p.Priority.Value] {
			return nil, apperror.Invalid("invalid_priority", "priority must be urgent, high, normal or low")
		}
		t.Priority = p.Priority.Value
	}
	if p.Assignees.Set {
		next := uniq(deref(p.Assignees.Value))
		if err := s.requireMembers(ctx, ws, next); err != nil {
			return nil, err
		}
		t.Assignees = next
	}
	if p.Tags.Set {
		t.Tags = cleanTags(deref(p.Tags.Value))
	}
	if p.StartDate.Set {
		if err := validDate(p.StartDate.Value); err != nil {
			return nil, err
		}
		t.StartDate = p.StartDate.Value
	}
	if p.DueDate.Set {
		if err := validDate(p.DueDate.Value); err != nil {
			return nil, err
		}
		t.DueDate = p.DueDate.Value
	}
	if p.Estimate.Set {
		t.Estimate = p.Estimate.Value
	}
	if p.Checklist.Set {
		t.Checklist = deref(p.Checklist.Value)
		for i := range t.Checklist {
			if t.Checklist[i].ID == "" {
				t.Checklist[i].ID = uuid.NewString()
			}
		}
	}
	if p.Recurrence.Set {
		if p.Recurrence.Value != nil && !validRecurrences[*p.Recurrence.Value] {
			return nil, apperror.Invalid("invalid_recurrence", "recurrence must be daily, weekly or monthly")
		}
		t.Recurrence = p.Recurrence.Value
	}
	if p.Custom.Set {
		if t.Custom == nil {
			t.Custom = map[string]any{}
		}
		for k, v := range deref(p.Custom.Value) {
			if v == nil {
				delete(t.Custom, k)
			} else {
				t.Custom[k] = v
			}
		}
	}
	if p.SprintID.Set {
		if p.SprintID.Value != nil {
			if _, err := s.repo.GetSprint(ctx, ws, *p.SprintID.Value); err != nil {
				return nil, err
			}
		}
		t.SprintID = p.SprintID.Value
	}
	if p.Points.Set {
		t.Points = p.Points.Value
	}
	if p.Watchers.Set {
		next := uniq(deref(p.Watchers.Value))
		if err := s.requireMembers(ctx, ws, next); err != nil {
			return nil, err
		}
		t.Watchers = next
	}
	if p.ClipIDs.Set {
		t.ClipIDs = uniq(deref(p.ClipIDs.Value))
	}
	if p.Order.Set && p.Order.Value != nil {
		t.Order = *p.Order.Value
	}

	if err := s.repo.UpdateTask(ctx, t); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "tasks", "upsert", t)
	s.afterUpdate(ctx, &prev, t, proj, actorID, 0)
	return t, nil
}

// afterUpdate runs the side effects of a change from prev to t.
func (s *Service) afterUpdate(ctx context.Context, prev, t *domain.Task, proj *domain.Project, actorID string, depth int) {
	ws := t.WorkspaceID
	if prev.StatusID != t.StatusID {
		from, _ := proj.Status(prev.StatusID)
		to, _ := proj.Status(t.StatusID)
		s.logActivity(ctx, ws, t.ID, actorID, fmt.Sprintf("changed status from %s to %s", from.Name, to.Name))
		s.notifyAll(ctx, ws, append(append([]string{}, t.Assignees...), t.Watchers...), "status", t.ID, actorID, "moved this to "+to.Name, false)
		if to.Finished() && t.Recurrence != nil {
			s.spawnRecurrence(ctx, t, proj, actorID)
		}
		s.runAutomations(ctx, t, proj, actorID, "status_changed", t.StatusID, depth)
	}
	if deref(prev.Priority) != deref(t.Priority) {
		if t.Priority != nil {
			s.logActivity(ctx, ws, t.ID, actorID, "set priority to "+*t.Priority)
			s.runAutomations(ctx, t, proj, actorID, "priority_changed", *t.Priority, depth)
		} else {
			s.logActivity(ctx, ws, t.ID, actorID, "cleared priority")
		}
	}
	if deref(prev.DueDate) != deref(t.DueDate) {
		if t.DueDate != nil {
			s.logActivity(ctx, ws, t.ID, actorID, "changed due date to "+*t.DueDate)
		} else {
			s.logActivity(ctx, ws, t.ID, actorID, "removed due date")
		}
	}
	if deref(prev.Recurrence) != deref(t.Recurrence) && prev.StatusID == t.StatusID {
		if t.Recurrence != nil {
			s.logActivity(ctx, ws, t.ID, actorID, "set task to repeat "+*t.Recurrence)
		} else {
			s.logActivity(ctx, ws, t.ID, actorID, "stopped repeating this task")
		}
	}
	for _, a := range t.Assignees {
		if !contains(prev.Assignees, a) {
			s.logActivity(ctx, ws, t.ID, actorID, "assigned "+s.names.DisplayName(ctx, a))
			s.notifyAll(ctx, ws, []string{a}, "assigned", t.ID, actorID, "assigned you to this task", true)
			s.runAutomations(ctx, t, proj, actorID, "assignee_added", a, depth)
		}
	}
}

func deref[T any](v *T) T {
	if v == nil {
		var zero T
		return zero
	}
	return *v
}

func (s *Service) DeleteTask(ctx context.Context, ws, id string) error {
	ids, err := s.repo.DeleteTask(ctx, ws, id)
	if err != nil {
		return err
	}
	for _, x := range ids {
		s.deleted(ctx, ws, "tasks", x)
	}
	changed, err := s.repo.RemoveFromBlockedBy(ctx, ws, ids)
	if err != nil {
		return err
	}
	for i := range changed {
		s.emit(ctx, ws, "tasks", "upsert", &changed[i])
	}
	return nil
}

func (s *Service) DuplicateTask(ctx context.Context, ws, actorID, id, newID string) (*domain.Task, error) {
	t, err := s.repo.GetTask(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	checklist := make([]domain.ChecklistItem, len(t.Checklist))
	for i, c := range t.Checklist {
		checklist[i] = domain.ChecklistItem{Text: c.Text, Done: c.Done}
	}
	title := t.Title + " (copy)"
	if len(title) > 500 {
		title = title[:500]
	}
	return s.CreateTask(ctx, ws, actorID, TaskInput{
		ID: newID, ListID: t.ListID, ParentID: t.ParentID, Title: title, Description: t.Description, StatusID: t.StatusID, Priority: t.Priority,
		Assignees: t.Assignees, Tags: t.Tags, StartDate: t.StartDate, DueDate: t.DueDate, Estimate: t.Estimate, Checklist: checklist,
		Recurrence: t.Recurrence, Custom: t.Custom, SprintID: t.SprintID, Points: t.Points,
	})
}

// MoveTask changes status and places the task just before beforeID (or last).
func (s *Service) MoveTask(ctx context.Context, ws, actorID, id, statusID string, beforeID *string) (*domain.Task, error) {
	t, err := s.repo.GetTask(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	var order float64
	if beforeID != nil {
		all, err := s.repo.ListTasks(ctx, ws)
		if err != nil {
			return nil, err
		}
		var before *domain.Task
		for i := range all {
			if all[i].ID == *beforeID {
				before = &all[i]
			}
		}
		if before == nil {
			return nil, domain.ErrTaskNotFound
		}
		order = before.Order - 1
		var best float64
		found := false
		for _, x := range all {
			if x.ID != id && x.ListID == t.ListID && x.StatusID == statusID && x.Order < before.Order && (!found || x.Order > best) {
				best, found = x.Order, true
			}
		}
		if found {
			order = (best + before.Order) / 2
		}
	} else {
		m, err := s.repo.MaxOrder(ctx, ws)
		if err != nil {
			return nil, err
		}
		order = m + 1
	}
	return s.UpdateTask(ctx, ws, actorID, id, TaskPatch{StatusID: optional.Of(statusID), Order: optional.Of(order)})
}

// BulkUpdate applies the same patch to many tasks; it stops at the first error.
func (s *Service) BulkUpdate(ctx context.Context, ws, actorID string, ids []string, p TaskPatch, addAssignee string) ([]domain.Task, error) {
	out := make([]domain.Task, 0, len(ids))
	for _, id := range ids {
		patch := p
		if addAssignee != "" {
			t, err := s.repo.GetTask(ctx, ws, id)
			if err != nil {
				return nil, err
			}
			if !contains(t.Assignees, addAssignee) {
				patch.Assignees = optional.Of(append(append([]string{}, t.Assignees...), addAssignee))
			}
		}
		t, err := s.UpdateTask(ctx, ws, actorID, id, patch)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, nil
}

func (s *Service) BulkDelete(ctx context.Context, ws string, ids []string) error {
	for _, id := range ids {
		if err := s.DeleteTask(ctx, ws, id); err != nil && !apperror.IsKind(err, apperror.KindNotFound) {
			return err
		}
	}
	return nil
}

// AddDependency makes taskID wait on blockerID, refusing direct cycles.
func (s *Service) AddDependency(ctx context.Context, ws, actorID, taskID, blockerID string) (*domain.Task, error) {
	if taskID == blockerID {
		return nil, domain.ErrDependencyCycle
	}
	t, err := s.repo.GetTask(ctx, ws, taskID)
	if err != nil {
		return nil, err
	}
	b, err := s.repo.GetTask(ctx, ws, blockerID)
	if err != nil {
		return nil, err
	}
	if contains(b.BlockedBy, taskID) {
		return nil, domain.ErrDependencyCycle
	}
	if contains(t.BlockedBy, blockerID) {
		return t, nil
	}
	t.BlockedBy = append(t.BlockedBy, blockerID)
	if err := s.repo.UpdateTask(ctx, t); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "tasks", "upsert", t)
	s.logActivity(ctx, ws, t.ID, actorID, "added a dependency: waiting on “"+b.Title+"”")
	return t, nil
}

func (s *Service) RemoveDependency(ctx context.Context, ws, taskID, blockerID string) (*domain.Task, error) {
	t, err := s.repo.GetTask(ctx, ws, taskID)
	if err != nil {
		return nil, err
	}
	next := t.BlockedBy[:0]
	for _, b := range t.BlockedBy {
		if b != blockerID {
			next = append(next, b)
		}
	}
	t.BlockedBy = next
	if err := s.repo.UpdateTask(ctx, t); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "tasks", "upsert", t)
	return t, nil
}

// ImportTasks creates tasks from parsed rows (CSV import) and returns how many were created.
func (s *Service) ImportTasks(ctx context.Context, ws, actorID, listID string, rows []TaskInput) (int, error) {
	n := 0
	for _, r := range rows {
		if strings.TrimSpace(r.Title) == "" {
			continue
		}
		r.ListID = listID
		r.ParentID = nil
		if _, err := s.CreateTask(ctx, ws, actorID, r); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}
