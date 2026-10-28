package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

func (r *Repository) InboxToken(ctx context.Context, ws, listID string) (string, error) {
	var tok string
	err := r.db.QueryRowContext(ctx, `SELECT token FROM work.list_inboxes WHERE workspace_id=$1 AND list_id=$2`, ws, listID).Scan(&tok)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrInboxNotFound
	}
	return tok, err
}

func (r *Repository) SaveInbox(ctx context.Context, ws, listID, actor, token string) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO work.list_inboxes (list_id, workspace_id, token, created_by) VALUES ($1,$2,$3,NULLIF($4,'')::uuid)
		ON CONFLICT (list_id) DO UPDATE SET token=EXCLUDED.token, created_at=now()`, listID, ws, token, actor)
	return err
}

func (r *Repository) DeleteInbox(ctx context.Context, ws, listID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM work.list_inboxes WHERE workspace_id=$1 AND list_id=$2`, ws, listID)
	return err
}

func (r *Repository) InboxByToken(ctx context.Context, token string) (string, string, error) {
	var ws, list string
	err := r.db.QueryRowContext(ctx, `SELECT workspace_id::text, list_id::text FROM work.list_inboxes WHERE token=$1`, token).Scan(&ws, &list)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", domain.ErrInboxNotFound
	}
	return ws, list, err
}
