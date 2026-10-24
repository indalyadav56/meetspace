package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/pgjson"
)

// actorOrBot maps a NULL author column to the bot id clients understand.
func actorOrBot(ns sql.NullString) string {
	if !ns.Valid {
		return domain.BotID
	}
	return ns.String
}

func botToNull(id string) any {
	if id == "" || id == domain.BotID {
		return nil
	}
	return id
}

// ---- comments

const commentCols = `id, task_id, user_id::text, text, assignee::text, resolved, created_at`

func scanComment(r row) (*domain.Comment, error) {
	var c domain.Comment
	var user, assignee sql.NullString
	if err := r.Scan(&c.ID, &c.TaskID, &user, &c.Text, &assignee, &c.Resolved, &c.CreatedAt); err != nil {
		return nil, notFound(err, domain.ErrCommentNotFound)
	}
	c.UserID, c.Assignee = actorOrBot(user), ptr(assignee)
	return &c, nil
}

func (r *Repository) CreateComment(ctx context.Context, ws string, c *domain.Comment) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.comments (workspace_id, task_id, user_id, text, assignee) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
		ws, c.TaskID, botToNull(c.UserID), c.Text, c.Assignee).Scan(&c.ID, &c.CreatedAt)
}

func (r *Repository) GetComment(ctx context.Context, ws, id string) (*domain.Comment, error) {
	return scanComment(r.db.QueryRowContext(ctx, `SELECT `+commentCols+` FROM work.comments WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) UpdateComment(ctx context.Context, ws string, c *domain.Comment) error {
	return execOne(ctx, r.db, domain.ErrCommentNotFound, `UPDATE work.comments SET text=$3, assignee=$4, resolved=$5 WHERE workspace_id=$1 AND id=$2`, ws, c.ID, c.Text, c.Assignee, c.Resolved)
}

func (r *Repository) ListComments(ctx context.Context, ws string) ([]domain.Comment, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+commentCols+` FROM work.comments WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Comment
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// ---- activity

func (r *Repository) CreateActivity(ctx context.Context, ws string, a *domain.Activity) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.activity (workspace_id, task_id, actor_id, text) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
		ws, a.TaskID, botToNull(a.UserID), a.Text).Scan(&a.ID, &a.CreatedAt)
}

func (r *Repository) ListActivity(ctx context.Context, ws string, limit int) ([]domain.Activity, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, task_id, actor_id::text, text, created_at FROM (
		SELECT * FROM work.activity WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT $2) a ORDER BY created_at`, ws, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Activity
	for rows.Next() {
		var a domain.Activity
		var actor sql.NullString
		if err := rows.Scan(&a.ID, &a.TaskID, &actor, &a.Text, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.UserID = actorOrBot(actor)
		out = append(out, a)
	}
	return out, rows.Err()
}

// ---- custom fields

func scanField(r row) (*domain.CustomField, error) {
	var f domain.CustomField
	if err := r.Scan(&f.ID, &f.ListID, &f.Name, &f.Type, pgjson.Scan(&f.Options)); err != nil {
		return nil, notFound(err, domain.ErrFieldNotFound)
	}
	if f.Options == nil {
		f.Options = []domain.FieldOption{}
	}
	return &f, nil
}

func (r *Repository) CreateField(ctx context.Context, ws string, f *domain.CustomField) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.custom_fields (id, workspace_id, list_id, name, type, options) VALUES (COALESCE(NULLIF($6, '')::uuid, uuidv7()), $1,$2,$3,$4,$5) RETURNING id`,
		ws, f.ListID, f.Name, f.Type, pgjson.Value(f.Options), f.ID).Scan(&f.ID)
}

func (r *Repository) GetField(ctx context.Context, ws, id string) (*domain.CustomField, error) {
	return scanField(r.db.QueryRowContext(ctx, `SELECT id, list_id, name, type, options FROM work.custom_fields WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) ListFields(ctx context.Context, ws string) ([]domain.CustomField, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, list_id, name, type, options FROM work.custom_fields WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CustomField
	for rows.Next() {
		f, err := scanField(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *f)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateField(ctx context.Context, ws string, f *domain.CustomField) error {
	return execOne(ctx, r.db, domain.ErrFieldNotFound, `UPDATE work.custom_fields SET name=$3, options=$4 WHERE workspace_id=$1 AND id=$2`, ws, f.ID, f.Name, pgjson.Value(f.Options))
}

func (r *Repository) DeleteField(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrFieldNotFound, `DELETE FROM work.custom_fields WHERE workspace_id=$1 AND id=$2`, ws, id)
}

func (r *Repository) RemoveCustomValue(ctx context.Context, ws, fieldID string) ([]domain.Task, error) {
	return r.queryTasks(ctx, `UPDATE work.tasks SET custom = custom - $2, updated_at=now() WHERE workspace_id=$1 AND deleted_at IS NULL AND custom ? $2 RETURNING `+taskCols, ws, fieldID)
}

// ---- time tracking

func scanEntry(r row) (*domain.TimeEntry, error) {
	var e domain.TimeEntry
	if err := r.Scan(&e.ID, &e.TaskID, &e.UserID, &e.Start, &e.Duration, &e.Note); err != nil {
		return nil, notFound(err, domain.ErrEntryNotFound)
	}
	return &e, nil
}

const entryCols = `id, task_id, user_id, started_at, duration_min, note`

func (r *Repository) CreateTimeEntry(ctx context.Context, ws string, e *domain.TimeEntry) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.time_entries (workspace_id, task_id, user_id, started_at, duration_min, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
		ws, e.TaskID, e.UserID, e.Start, e.Duration, e.Note).Scan(&e.ID)
}

func (r *Repository) GetTimeEntry(ctx context.Context, ws, id string) (*domain.TimeEntry, error) {
	return scanEntry(r.db.QueryRowContext(ctx, `SELECT `+entryCols+` FROM work.time_entries WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) UpdateTimeEntry(ctx context.Context, ws string, e *domain.TimeEntry) error {
	return execOne(ctx, r.db, domain.ErrEntryNotFound, `UPDATE work.time_entries SET started_at=$3, duration_min=$4, note=$5 WHERE workspace_id=$1 AND id=$2`, ws, e.ID, e.Start, e.Duration, e.Note)
}

func (r *Repository) DeleteTimeEntry(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrEntryNotFound, `DELETE FROM work.time_entries WHERE workspace_id=$1 AND id=$2`, ws, id)
}

func (r *Repository) ListTimeEntries(ctx context.Context, ws string) ([]domain.TimeEntry, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+entryCols+` FROM work.time_entries WHERE workspace_id=$1 ORDER BY started_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.TimeEntry
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *e)
	}
	return out, rows.Err()
}

func (r *Repository) GetTimer(ctx context.Context, ws, userID string) (*domain.Timer, error) {
	var t domain.Timer
	err := r.db.QueryRowContext(ctx, `SELECT task_id, started_at FROM work.timers WHERE workspace_id=$1 AND user_id=$2`, ws, userID).Scan(&t.TaskID, &t.Start)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &t, err
}

func (r *Repository) SetTimer(ctx context.Context, ws, userID string, t domain.Timer) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO work.timers (workspace_id, user_id, task_id, started_at) VALUES ($1,$2,$3,$4)
		ON CONFLICT (workspace_id, user_id) DO UPDATE SET task_id=EXCLUDED.task_id, started_at=EXCLUDED.started_at`, ws, userID, t.TaskID, t.Start)
	return err
}

func (r *Repository) DeleteTimer(ctx context.Context, ws, userID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM work.timers WHERE workspace_id=$1 AND user_id=$2`, ws, userID)
	return err
}

// ---- sprints

const sprintCols = `id, project_id, name, goal, start_date::text, end_date::text, status, completed_points::float8`

func scanSprint(r row) (*domain.Sprint, error) {
	var s domain.Sprint
	var cp sql.NullFloat64
	if err := r.Scan(&s.ID, &s.ProjectID, &s.Name, &s.Goal, &s.StartDate, &s.EndDate, &s.Status, &cp); err != nil {
		return nil, notFound(err, domain.ErrSprintNotFound)
	}
	s.CompletedPoints = fptr(cp)
	return &s, nil
}

func (r *Repository) CreateSprint(ctx context.Context, ws string, s *domain.Sprint) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.sprints (id, workspace_id, project_id, name, goal, start_date, end_date, status) VALUES (COALESCE(NULLIF($8, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		ws, s.ProjectID, s.Name, s.Goal, s.StartDate, s.EndDate, s.Status, s.ID).Scan(&s.ID)
}

func (r *Repository) GetSprint(ctx context.Context, ws, id string) (*domain.Sprint, error) {
	return scanSprint(r.db.QueryRowContext(ctx, `SELECT `+sprintCols+` FROM work.sprints WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) ListSprints(ctx context.Context, ws string) ([]domain.Sprint, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+sprintCols+` FROM work.sprints WHERE workspace_id=$1 ORDER BY start_date`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Sprint
	for rows.Next() {
		s, err := scanSprint(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateSprint(ctx context.Context, ws string, s *domain.Sprint) error {
	return execOne(ctx, r.db, domain.ErrSprintNotFound, `UPDATE work.sprints SET name=$3, goal=$4, start_date=$5, end_date=$6, status=$7, completed_points=$8 WHERE workspace_id=$1 AND id=$2`,
		ws, s.ID, s.Name, s.Goal, s.StartDate, s.EndDate, s.Status, s.CompletedPoints)
}

func (r *Repository) DeleteSprint(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrSprintNotFound, `DELETE FROM work.sprints WHERE workspace_id=$1 AND id=$2`, ws, id)
}

// ---- automations

const automationCols = `id, project_id, name, enabled, trigger, actions, runs, last_run`

func scanAutomation(r row) (*domain.Automation, error) {
	var a domain.Automation
	var last sql.NullTime
	if err := r.Scan(&a.ID, &a.ProjectID, &a.Name, &a.Enabled, pgjson.Scan(&a.Trigger), pgjson.Scan(&a.Actions), &a.Runs, &last); err != nil {
		return nil, notFound(err, domain.ErrAutomationNotFound)
	}
	if last.Valid {
		a.LastRun = &last.Time
	}
	if a.Actions == nil {
		a.Actions = []domain.Action{}
	}
	return &a, nil
}

func (r *Repository) CreateAutomation(ctx context.Context, ws string, a *domain.Automation) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.automations (id, workspace_id, project_id, name, enabled, trigger, actions) VALUES (COALESCE(NULLIF($7, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6) RETURNING id`,
		ws, a.ProjectID, a.Name, a.Enabled, pgjson.Value(a.Trigger), pgjson.Value(a.Actions), a.ID).Scan(&a.ID)
}

func (r *Repository) GetAutomation(ctx context.Context, ws, id string) (*domain.Automation, error) {
	return scanAutomation(r.db.QueryRowContext(ctx, `SELECT `+automationCols+` FROM work.automations WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) ListAutomations(ctx context.Context, ws string) ([]domain.Automation, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+automationCols+` FROM work.automations WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Automation
	for rows.Next() {
		a, err := scanAutomation(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateAutomation(ctx context.Context, ws string, a *domain.Automation) error {
	return execOne(ctx, r.db, domain.ErrAutomationNotFound, `UPDATE work.automations SET name=$3, enabled=$4, trigger=$5, actions=$6 WHERE workspace_id=$1 AND id=$2`,
		ws, a.ID, a.Name, a.Enabled, pgjson.Value(a.Trigger), pgjson.Value(a.Actions))
}

func (r *Repository) DeleteAutomation(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrAutomationNotFound, `DELETE FROM work.automations WHERE workspace_id=$1 AND id=$2`, ws, id)
}

func (r *Repository) RecordAutomationRun(ctx context.Context, ws, id string, at time.Time) (*domain.Automation, error) {
	return scanAutomation(r.db.QueryRowContext(ctx, `UPDATE work.automations SET runs = runs + 1, last_run=$3 WHERE workspace_id=$1 AND id=$2 RETURNING `+automationCols, ws, id, at))
}

// ---- forms

const formCols = `id, workspace_id, list_id, title, description, color, fields, assign_to, submit_text, thanks_text, active, submissions, created_at`

func scanForm(r row) (*domain.Form, error) {
	var f domain.Form
	if err := r.Scan(&f.ID, &f.WorkspaceID, &f.ListID, &f.Title, &f.Description, &f.Color, pgjson.Scan(&f.Fields), pgjson.Scan(&f.AssignTo),
		&f.SubmitText, &f.ThanksText, &f.Active, &f.Submissions, &f.CreatedAt); err != nil {
		return nil, notFound(err, domain.ErrFormNotFound)
	}
	if f.Fields == nil {
		f.Fields = []domain.FormField{}
	}
	if f.AssignTo == nil {
		f.AssignTo = []string{}
	}
	return &f, nil
}

func (r *Repository) CreateForm(ctx context.Context, f *domain.Form) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.forms (id, workspace_id, list_id, title, description, color, fields, assign_to, submit_text, thanks_text, active)
		VALUES (COALESCE(NULLIF($11, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at`,
		f.WorkspaceID, f.ListID, f.Title, f.Description, f.Color, pgjson.Value(f.Fields), pgjson.Value(f.AssignTo), f.SubmitText, f.ThanksText, f.Active, f.ID).Scan(&f.ID, &f.CreatedAt)
}

func (r *Repository) GetForm(ctx context.Context, ws, id string) (*domain.Form, error) {
	return scanForm(r.db.QueryRowContext(ctx, `SELECT `+formCols+` FROM work.forms WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) GetFormPublic(ctx context.Context, id string) (*domain.Form, error) {
	return scanForm(r.db.QueryRowContext(ctx, `SELECT `+formCols+` FROM work.forms WHERE id=$1`, id))
}

func (r *Repository) ListForms(ctx context.Context, ws string) ([]domain.Form, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+formCols+` FROM work.forms WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Form
	for rows.Next() {
		f, err := scanForm(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *f)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateForm(ctx context.Context, f *domain.Form) error {
	return execOne(ctx, r.db, domain.ErrFormNotFound, `UPDATE work.forms SET list_id=$3, title=$4, description=$5, color=$6, fields=$7, assign_to=$8, submit_text=$9, thanks_text=$10, active=$11
		WHERE workspace_id=$1 AND id=$2`,
		f.WorkspaceID, f.ID, f.ListID, f.Title, f.Description, f.Color, pgjson.Value(f.Fields), pgjson.Value(f.AssignTo), f.SubmitText, f.ThanksText, f.Active)
}

func (r *Repository) DeleteForm(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrFormNotFound, `DELETE FROM work.forms WHERE workspace_id=$1 AND id=$2`, ws, id)
}

func (r *Repository) IncrementSubmissions(ctx context.Context, ws, id string) (*domain.Form, error) {
	return scanForm(r.db.QueryRowContext(ctx, `UPDATE work.forms SET submissions = submissions + 1 WHERE workspace_id=$1 AND id=$2 RETURNING `+formCols, ws, id))
}

// ---- timesheets

const timesheetCols = `user_id, to_char(week_start, 'YYYY-MM-DD'), status, note, submitted_at, decided_by, decided_at`

func scanTimesheet(r row) (*domain.Timesheet, error) {
	var t domain.Timesheet
	var decided sql.NullString
	if err := r.Scan(&t.UserID, &t.WeekStart, &t.Status, &t.Note, &t.SubmittedAt, &decided, &t.DecidedAt); err != nil {
		return nil, err
	}
	if decided.Valid {
		t.DecidedBy = &decided.String
	}
	return &t, nil
}

func (r *Repository) GetTimesheet(ctx context.Context, ws, userID, weekStart string) (*domain.Timesheet, error) {
	t, err := scanTimesheet(r.db.QueryRowContext(ctx, `SELECT `+timesheetCols+` FROM work.timesheets WHERE workspace_id=$1 AND user_id=$2 AND week_start=$3`, ws, userID, weekStart))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return t, err
}

func (r *Repository) SaveTimesheet(ctx context.Context, ws string, t *domain.Timesheet) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO work.timesheets (workspace_id, user_id, week_start, status, note, submitted_at, decided_by, decided_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
		ON CONFLICT (workspace_id, user_id, week_start) DO UPDATE SET
			status=EXCLUDED.status, note=EXCLUDED.note, submitted_at=EXCLUDED.submitted_at,
			decided_by=EXCLUDED.decided_by, decided_at=EXCLUDED.decided_at, updated_at=now()`,
		ws, t.UserID, t.WeekStart, t.Status, t.Note, t.SubmittedAt, t.DecidedBy, t.DecidedAt)
	return err
}

// ListTimesheets returns the last year of sheets.
func (r *Repository) ListTimesheets(ctx context.Context, ws string) ([]domain.Timesheet, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+timesheetCols+` FROM work.timesheets WHERE workspace_id=$1 AND week_start > now() - interval '1 year' ORDER BY week_start DESC`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Timesheet{}
	for rows.Next() {
		t, err := scanTimesheet(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}
