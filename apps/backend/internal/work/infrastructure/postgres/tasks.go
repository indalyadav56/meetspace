package postgres

import (
	"context"
	"database/sql"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/pgjson"
)

const taskCols = `id, workspace_id, key, list_id, parent_id::text, title, description, status_id, priority,
	assignees, tags, start_date::text, due_date::text, estimate::float8, checklist, blocked_by, recurrence, custom,
	sprint_id::text, points::float8, watchers, clip_ids, position, created_by::text, created_at, updated_at`

func scanTask(r row) (*domain.Task, error) {
	var t domain.Task
	var parent, priority, start, due, recurrence, sprint, createdBy sql.NullString
	var estimate, points sql.NullFloat64
	err := r.Scan(&t.ID, &t.WorkspaceID, &t.Key, &t.ListID, &parent, &t.Title, &t.Description, &t.StatusID, &priority,
		pgjson.Scan(&t.Assignees), pgjson.Scan(&t.Tags), &start, &due, &estimate, pgjson.Scan(&t.Checklist), pgjson.Scan(&t.BlockedBy),
		&recurrence, pgjson.Scan(&t.Custom), &sprint, &points, pgjson.Scan(&t.Watchers), pgjson.Scan(&t.ClipIDs), &t.Order, &createdBy,
		&t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, notFound(err, domain.ErrTaskNotFound)
	}
	t.ParentID, t.Priority, t.StartDate, t.DueDate = ptr(parent), ptr(priority), ptr(start), ptr(due)
	t.Recurrence, t.SprintID, t.CreatedBy = ptr(recurrence), ptr(sprint), ptr(createdBy)
	t.Estimate, t.Points = fptr(estimate), fptr(points)
	normalize(&t)
	return &t, nil
}

// normalize guarantees non-nil collections so clients never see null arrays.
func normalize(t *domain.Task) {
	if t.Assignees == nil {
		t.Assignees = []string{}
	}
	if t.Tags == nil {
		t.Tags = []string{}
	}
	if t.Checklist == nil {
		t.Checklist = []domain.ChecklistItem{}
	}
	if t.BlockedBy == nil {
		t.BlockedBy = []string{}
	}
	if t.Custom == nil {
		t.Custom = map[string]any{}
	}
	if t.Watchers == nil {
		t.Watchers = []string{}
	}
	if t.ClipIDs == nil {
		t.ClipIDs = []string{}
	}
}

func (r *Repository) CreateTask(ctx context.Context, t *domain.Task) error {
	normalize(t)
	return r.db.QueryRowContext(ctx, `
		INSERT INTO work.tasks (id, workspace_id, key, list_id, parent_id, title, description, status_id, priority, assignees, tags,
			start_date, due_date, estimate, checklist, blocked_by, recurrence, custom, sprint_id, points, watchers, clip_ids, position, created_by)
		VALUES (COALESCE(NULLIF($24, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
		RETURNING id, created_at, updated_at`,
		t.WorkspaceID, t.Key, t.ListID, t.ParentID, t.Title, t.Description, t.StatusID, t.Priority, pgjson.Value(t.Assignees), pgjson.Value(t.Tags),
		t.StartDate, t.DueDate, t.Estimate, pgjson.Value(t.Checklist), pgjson.Value(t.BlockedBy), t.Recurrence, customValue(t.Custom), t.SprintID, t.Points,
		pgjson.Value(t.Watchers), pgjson.Value(t.ClipIDs), t.Order, t.CreatedBy, t.ID).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

// customValue keeps an empty custom map as {} rather than [].
func customValue(m map[string]any) any {
	if len(m) == 0 {
		return []byte("{}")
	}
	return pgjson.Value(m)
}

func (r *Repository) GetTask(ctx context.Context, ws, id string) (*domain.Task, error) {
	return scanTask(r.db.QueryRowContext(ctx, `SELECT `+taskCols+` FROM work.tasks WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL`, ws, id))
}

func (r *Repository) GetTaskByKey(ctx context.Context, ws string, key int64) (*domain.Task, error) {
	return scanTask(r.db.QueryRowContext(ctx, `SELECT `+taskCols+` FROM work.tasks WHERE workspace_id=$1 AND key=$2 AND deleted_at IS NULL`, ws, key))
}

func (r *Repository) queryTasks(ctx context.Context, q string, args ...any) ([]domain.Task, error) {
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

func (r *Repository) ListTasks(ctx context.Context, ws string) ([]domain.Task, error) {
	return r.queryTasks(ctx, `SELECT `+taskCols+` FROM work.tasks WHERE workspace_id=$1 AND deleted_at IS NULL ORDER BY position`, ws)
}

func (r *Repository) UpdateTask(ctx context.Context, t *domain.Task) error {
	normalize(t)
	return r.db.QueryRowContext(ctx, `
		UPDATE work.tasks SET list_id=$3, parent_id=$4, title=$5, description=$6, status_id=$7, priority=$8, assignees=$9, tags=$10,
			start_date=$11, due_date=$12, estimate=$13, checklist=$14, blocked_by=$15, recurrence=$16, custom=$17, sprint_id=$18, points=$19,
			watchers=$20, clip_ids=$21, position=$22, updated_at=now()
		WHERE workspace_id=$1 AND id=$2 RETURNING updated_at`,
		t.WorkspaceID, t.ID, t.ListID, t.ParentID, t.Title, t.Description, t.StatusID, t.Priority, pgjson.Value(t.Assignees), pgjson.Value(t.Tags),
		t.StartDate, t.DueDate, t.Estimate, pgjson.Value(t.Checklist), pgjson.Value(t.BlockedBy), t.Recurrence, customValue(t.Custom), t.SprintID, t.Points,
		pgjson.Value(t.Watchers), pgjson.Value(t.ClipIDs), t.Order).Scan(&t.UpdatedAt)
}

func scanIDs(rows *sql.Rows, err error) ([]string, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var x string
		if err := rows.Scan(&x); err != nil {
			return nil, err
		}
		ids = append(ids, x)
	}
	if len(ids) == 0 {
		return nil, domain.ErrTaskNotFound
	}
	return ids, rows.Err()
}

// DeleteTask moves the task and its subtasks to the trash (one shared deleted_at) and returns their ids.
func (r *Repository) DeleteTask(ctx context.Context, ws, id, actorID string) ([]string, error) {
	return scanIDs(r.db.QueryContext(ctx, `
		WITH RECURSIVE tree AS (
		  SELECT id FROM work.tasks WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL
		  UNION ALL SELECT t.id FROM work.tasks t JOIN tree ON t.parent_id = tree.id WHERE t.deleted_at IS NULL
		)
		UPDATE work.tasks SET deleted_at = now(), deleted_by = NULLIF($3, '')::uuid WHERE id IN (SELECT id FROM tree) RETURNING id`, ws, id, actorID))
}

// RestoreTask brings back a trashed task and the subtasks that were trashed with it.
func (r *Repository) RestoreTask(ctx context.Context, ws, id string) ([]domain.Task, error) {
	tasks, err := r.queryTasks(ctx, `
		WITH RECURSIVE root AS (
		  SELECT id, deleted_at FROM work.tasks WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NOT NULL
		), tree AS (
		  SELECT id FROM root
		  UNION ALL SELECT t.id FROM work.tasks t JOIN tree ON t.parent_id = tree.id JOIN root ON t.deleted_at = root.deleted_at
		)
		UPDATE work.tasks SET deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE id IN (SELECT id FROM tree) RETURNING `+taskCols, ws, id)
	if err == nil && len(tasks) == 0 {
		return nil, domain.ErrTaskNotFound
	}
	return tasks, err
}

// PurgeTask permanently deletes a trashed task and everything under it.
func (r *Repository) PurgeTask(ctx context.Context, ws, id string) ([]string, error) {
	return scanIDs(r.db.QueryContext(ctx, `
		WITH RECURSIVE tree AS (
		  SELECT id FROM work.tasks WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NOT NULL
		  UNION ALL SELECT t.id FROM work.tasks t JOIN tree ON t.parent_id = tree.id
		)
		DELETE FROM work.tasks WHERE id IN (SELECT id FROM tree) RETURNING id`, ws, id))
}

// ListTrash returns trashed tasks that were deleted on their own (not with a trashed parent).
func (r *Repository) ListTrash(ctx context.Context, ws string) ([]domain.TrashedTask, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT t.id, t.key, t.title, t.list_id, t.deleted_at, COALESCE(t.deleted_by::text, ''),
		  (SELECT count(*) FROM work.tasks c WHERE c.parent_id = t.id AND c.deleted_at = t.deleted_at)
		FROM work.tasks t LEFT JOIN work.tasks p ON p.id = t.parent_id
		WHERE t.workspace_id=$1 AND t.deleted_at IS NOT NULL AND (p.id IS NULL OR p.deleted_at IS DISTINCT FROM t.deleted_at)
		ORDER BY t.deleted_at DESC LIMIT 500`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.TrashedTask{}
	for rows.Next() {
		var x domain.TrashedTask
		if err := rows.Scan(&x.ID, &x.Key, &x.Title, &x.ListID, &x.DeletedAt, &x.DeletedBy, &x.Subtasks); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (r *Repository) RemoveFromBlockedBy(ctx context.Context, ws string, ids []string) ([]domain.Task, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	// jsonb ?| finds tasks whose blocked_by contains any of the ids.
	return r.queryTasks(ctx, `
		UPDATE work.tasks SET blocked_by = COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements_text(blocked_by) x WHERE x <> ALL(string_to_array($2, ','))), '[]'::jsonb),
		  updated_at = now()
		WHERE workspace_id=$1 AND deleted_at IS NULL AND blocked_by ?| string_to_array($2, ',') RETURNING `+taskCols, ws, strings.Join(ids, ","))
}

func (r *Repository) MaxOrder(ctx context.Context, ws string) (float64, error) {
	var m sql.NullFloat64
	err := r.db.QueryRowContext(ctx, `SELECT max(position) FROM work.tasks WHERE workspace_id=$1`, ws).Scan(&m)
	return m.Float64, err
}
