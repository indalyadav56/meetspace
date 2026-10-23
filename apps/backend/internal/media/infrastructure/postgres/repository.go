// Package postgres implements the clip repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/media/domain"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

const cols = `id, workspace_id, title, kind, COALESCE(created_by::text,''), created_at, duration_sec, size, mime, task_id::text, transcript, thumb, storage_key`

func scan(r interface{ Scan(...any) error }) (*domain.Clip, error) {
	var c domain.Clip
	var task sql.NullString
	if err := r.Scan(&c.ID, &c.WorkspaceID, &c.Title, &c.Kind, &c.CreatedBy, &c.CreatedAt, &c.DurationSec, &c.Size, &c.Mime, &task, &c.Transcript, &c.Thumb, &c.StorageKey); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if task.Valid {
		c.TaskID = &task.String
	}
	return &c, nil
}

func (r *Repository) Create(ctx context.Context, c *domain.Clip) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO media.clips (workspace_id, title, kind, created_by, duration_sec, size, mime, task_id, transcript, thumb, storage_key)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, created_at`,
		c.WorkspaceID, c.Title, c.Kind, c.CreatedBy, c.DurationSec, c.Size, c.Mime, c.TaskID, c.Transcript, c.Thumb, c.StorageKey).Scan(&c.ID, &c.CreatedAt)
}

func (r *Repository) Get(ctx context.Context, ws, id string) (*domain.Clip, error) {
	return scan(r.db.QueryRowContext(ctx, `SELECT `+cols+` FROM media.clips WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) List(ctx context.Context, ws string) ([]domain.Clip, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+cols+` FROM media.clips WHERE workspace_id=$1 ORDER BY created_at DESC`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Clip
	for rows.Next() {
		c, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *Repository) Update(ctx context.Context, c *domain.Clip) error {
	_, err := r.db.ExecContext(ctx, `UPDATE media.clips SET title=$3, task_id=$4 WHERE workspace_id=$1 AND id=$2`, c.WorkspaceID, c.ID, c.Title, c.TaskID)
	return err
}

func (r *Repository) Delete(ctx context.Context, ws, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM media.clips WHERE workspace_id=$1 AND id=$2`, ws, id)
	return err
}
