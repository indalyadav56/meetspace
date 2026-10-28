// Package postgres stores calendar feed tokens.
package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/calfeed/application"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Token(ctx context.Context, ws, user string) (string, error) {
	var tok string
	err := r.db.QueryRowContext(ctx, `SELECT token FROM calendar.feeds WHERE workspace_id=$1 AND user_id=$2`, ws, user).Scan(&tok)
	if errors.Is(err, sql.ErrNoRows) {
		return "", application.ErrNotFound
	}
	return tok, err
}

func (r *Repository) Save(ctx context.Context, ws, user, token string) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO calendar.feeds (workspace_id, user_id, token) VALUES ($1,$2,$3)
		ON CONFLICT (workspace_id, user_id) DO UPDATE SET token=EXCLUDED.token, created_at=now()`, ws, user, token)
	return err
}

func (r *Repository) Delete(ctx context.Context, ws, user string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM calendar.feeds WHERE workspace_id=$1 AND user_id=$2`, ws, user)
	return err
}

func (r *Repository) Resolve(ctx context.Context, token string) (string, string, error) {
	var ws, user string
	err := r.db.QueryRowContext(ctx, `UPDATE calendar.feeds SET last_fetched_at=now() WHERE token=$1 RETURNING workspace_id::text, user_id::text`, token).Scan(&ws, &user)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", application.ErrNotFound
	}
	return ws, user, err
}
