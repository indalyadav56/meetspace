// Package postgres implements the notify repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

const nCols = `id, workspace_id, user_id, kind, COALESCE(task_id::text,''), COALESCE(actor_id::text,''), text, read, cleared, important, created_at`

func scanN(row interface{ Scan(...any) error }) (*domain.Notification, error) {
	var n domain.Notification
	err := row.Scan(&n.ID, &n.WorkspaceID, &n.UserID, &n.Kind, &n.TaskID, &n.ActorID, &n.Text, &n.Read, &n.Cleared, &n.Important, &n.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &n, err
}

func nullUUID(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (r *Repository) CreateNotification(ctx context.Context, n *domain.Notification) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO notify.notifications (workspace_id, user_id, kind, task_id, actor_id, text, important)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
		n.WorkspaceID, n.UserID, n.Kind, nullUUID(n.TaskID), nullUUID(n.ActorID), n.Text, n.Important).Scan(&n.ID, &n.CreatedAt)
}

func (r *Repository) ListNotifications(ctx context.Context, workspaceID, userID string, limit int) ([]domain.Notification, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+nCols+` FROM notify.notifications WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3`, workspaceID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Notification
	for rows.Next() {
		n, err := scanN(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *n)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateNotification(ctx context.Context, id, userID string, read, cleared *bool) (*domain.Notification, error) {
	return scanN(r.db.QueryRowContext(ctx, `
		UPDATE notify.notifications SET
		  read = COALESCE($3, read) OR COALESCE($4, false),
		  cleared = COALESCE($4, cleared)
		WHERE id=$1 AND user_id=$2 RETURNING `+nCols, id, userID, read, cleared))
}

func (r *Repository) MarkAllRead(ctx context.Context, workspaceID, userID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE notify.notifications SET read=true WHERE workspace_id=$1 AND user_id=$2 AND NOT read`, workspaceID, userID)
	return err
}

const rCols = `id, workspace_id, user_id, text, due, task_id::text, done, notified, created_at`

func scanR(row interface{ Scan(...any) error }) (*domain.Reminder, error) {
	var x domain.Reminder
	var task sql.NullString
	err := row.Scan(&x.ID, &x.WorkspaceID, &x.UserID, &x.Text, &x.Due, &task, &x.Done, &x.Notified, &x.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if task.Valid {
		x.TaskID = &task.String
	}
	return &x, err
}

func (r *Repository) CreateReminder(ctx context.Context, x *domain.Reminder) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO notify.reminders (id, workspace_id, user_id, text, due, task_id) VALUES (COALESCE(NULLIF($6, '')::uuid, uuidv7()), $1,$2,$3,$4,$5) RETURNING id, created_at`,
		x.WorkspaceID, x.UserID, x.Text, x.Due, x.TaskID, x.ID).Scan(&x.ID, &x.CreatedAt)
}

func (r *Repository) GetReminder(ctx context.Context, id, userID string) (*domain.Reminder, error) {
	return scanR(r.db.QueryRowContext(ctx, `SELECT `+rCols+` FROM notify.reminders WHERE id=$1 AND user_id=$2`, id, userID))
}

func (r *Repository) UpdateReminder(ctx context.Context, x *domain.Reminder) error {
	_, err := r.db.ExecContext(ctx, `UPDATE notify.reminders SET text=$2, due=$3, done=$4, notified=$5 WHERE id=$1`, x.ID, x.Text, x.Due, x.Done, x.Notified)
	return err
}

func (r *Repository) DeleteReminder(ctx context.Context, id, userID string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM notify.reminders WHERE id=$1 AND user_id=$2`, id, userID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Repository) ListReminders(ctx context.Context, workspaceID, userID string) ([]domain.Reminder, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+rCols+` FROM notify.reminders WHERE workspace_id=$1 AND user_id=$2 AND NOT done ORDER BY due`, workspaceID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Reminder
	for rows.Next() {
		x, err := scanR(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *x)
	}
	return out, rows.Err()
}

func (r *Repository) ClaimDue(ctx context.Context, now time.Time, limit int) ([]domain.Reminder, error) {
	// SKIP LOCKED lets several worker replicas claim disjoint batches.
	rows, err := r.db.QueryContext(ctx, `
		UPDATE notify.reminders SET notified=true WHERE id IN (
		  SELECT id FROM notify.reminders WHERE NOT done AND NOT notified AND due <= $1
		  ORDER BY due LIMIT $2 FOR UPDATE SKIP LOCKED
		) RETURNING `+rCols, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Reminder
	for rows.Next() {
		x, err := scanR(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *x)
	}
	return out, rows.Err()
}
