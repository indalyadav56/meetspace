package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/indalyadav56/meetspace/backend/internal/tasks/domain"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

const taskCols = `id, key, title, description, status, priority, type, team_id,
	assignee_ids, tags, due_date, subtasks, comments, created_at, updated_at`

func (r *Repository) List(ctx context.Context, f domain.ListFilter) ([]domain.Task, error) {
	query := `SELECT ` + taskCols + ` FROM tasks WHERE 1=1`
	args := []any{}
	if f.TeamID != "" {
		args = append(args, f.TeamID)
		query += fmt.Sprintf(" AND team_id = $%d", len(args))
	}
	if f.Status != "" {
		args = append(args, f.Status)
		query += fmt.Sprintf(" AND status = $%d", len(args))
	}
	if f.AssigneeID != "" {
		args = append(args, f.AssigneeID)
		query += fmt.Sprintf(" AND assignee_ids @> to_jsonb(ARRAY[$%d::text])", len(args))
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []domain.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, *t)
	}
	return tasks, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id string) (*domain.Task, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+taskCols+` FROM tasks WHERE id = $1`, id)
	t, err := scanTask(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrTaskNotFound
	}
	return t, err
}

func (r *Repository) Create(ctx context.Context, t *domain.Task) error {
	assignees, tags, subtasks, comments, err := marshalTaskJSON(t)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO tasks (id, key, title, description, status, priority, type, team_id,
			assignee_ids, tags, due_date, subtasks, comments, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		t.ID, t.Key, t.Title, t.Description, t.Status, t.Priority, t.Type, t.TeamID,
		assignees, tags, t.DueDate, subtasks, comments, t.CreatedAt, t.UpdatedAt)
	return err
}

func (r *Repository) Update(ctx context.Context, t *domain.Task) error {
	assignees, tags, subtasks, comments, err := marshalTaskJSON(t)
	if err != nil {
		return err
	}
	res, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET title=$2, description=$3, status=$4, priority=$5, type=$6,
			assignee_ids=$7, tags=$8, due_date=$9, subtasks=$10, comments=$11, updated_at=$12
		 WHERE id=$1`,
		t.ID, t.Title, t.Description, t.Status, t.Priority, t.Type,
		assignees, tags, t.DueDate, subtasks, comments, t.UpdatedAt)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return domain.ErrTaskNotFound
	}
	return err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return domain.ErrTaskNotFound
	}
	return err
}

func (r *Repository) NextKeyNumber(ctx context.Context, teamID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO task_counters (team_id, n) VALUES ($1, 1)
		 ON CONFLICT (team_id) DO UPDATE SET n = task_counters.n + 1
		 RETURNING n`, teamID).Scan(&n)
	return n, err
}

type rowScanner interface{ Scan(dest ...any) error }

func scanTask(row rowScanner) (*domain.Task, error) {
	var t domain.Task
	var assignees, tags, subtasks, comments []byte
	var due sql.NullTime
	err := row.Scan(&t.ID, &t.Key, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.Type, &t.TeamID, &assignees, &tags, &due, &subtasks, &comments,
		&t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if due.Valid {
		t.DueDate = &due.Time
	}
	for _, pair := range []struct {
		raw []byte
		dst any
	}{
		{assignees, &t.AssigneeIDs},
		{tags, &t.Tags},
		{subtasks, &t.Subtasks},
		{comments, &t.Comments},
	} {
		if err := json.Unmarshal(pair.raw, pair.dst); err != nil {
			return nil, err
		}
	}
	return &t, nil
}

func marshalTaskJSON(t *domain.Task) (assignees, tags, subtasks, comments []byte, err error) {
	if assignees, err = json.Marshal(orEmpty(t.AssigneeIDs)); err != nil {
		return
	}
	if tags, err = json.Marshal(orEmpty(t.Tags)); err != nil {
		return
	}
	if t.Subtasks == nil {
		t.Subtasks = []domain.Subtask{}
	}
	if subtasks, err = json.Marshal(t.Subtasks); err != nil {
		return
	}
	if t.Comments == nil {
		t.Comments = []domain.Comment{}
	}
	comments, err = json.Marshal(t.Comments)
	return
}

func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
