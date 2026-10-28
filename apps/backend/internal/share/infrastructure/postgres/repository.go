// Package postgres stores share links.
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/share/domain"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

const cols = `id, workspace_id, kind, entity_id::text, token, created_by::text, expires_at, views, last_viewed_at, created_at`

func scan(r interface{ Scan(...any) error }) (*domain.Link, error) {
	var l domain.Link
	var by sql.NullString
	var exp, seen sql.NullTime
	if err := r.Scan(&l.ID, &l.WorkspaceID, &l.Kind, &l.EntityID, &l.Token, &by, &exp, &l.Views, &seen, &l.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if by.Valid {
		l.CreatedBy = &by.String
	}
	if exp.Valid {
		l.ExpiresAt = &exp.Time
	}
	if seen.Valid {
		l.LastViewedAt = &seen.Time
	}
	return &l, nil
}

func (r *Repository) Create(ctx context.Context, l *domain.Link) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO share.links (workspace_id, kind, entity_id, token, created_by, expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
		l.WorkspaceID, l.Kind, l.EntityID, l.Token, l.CreatedBy, l.ExpiresAt).Scan(&l.ID, &l.CreatedAt)
}

func (r *Repository) Active(ctx context.Context, ws, kind, entityID string) (*domain.Link, error) {
	return scan(r.db.QueryRowContext(ctx, `SELECT `+cols+` FROM share.links WHERE workspace_id=$1 AND kind=$2 AND entity_id=$3::uuid AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`, ws, kind, entityID))
}

func (r *Repository) ByToken(ctx context.Context, token string) (*domain.Link, error) {
	return scan(r.db.QueryRowContext(ctx, `SELECT `+cols+` FROM share.links WHERE token=$1 AND revoked_at IS NULL`, token))
}

func (r *Repository) SetExpiry(ctx context.Context, ws, id string, expires *time.Time) error {
	res, err := r.db.ExecContext(ctx, `UPDATE share.links SET expires_at=$3 WHERE workspace_id=$1 AND id=$2 AND revoked_at IS NULL`, ws, id, expires)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *Repository) Revoke(ctx context.Context, ws, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE share.links SET revoked_at=now() WHERE workspace_id=$1 AND id=$2`, ws, id)
	return err
}

func (r *Repository) CountView(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE share.links SET views=views+1, last_viewed_at=now() WHERE id=$1`, id)
	return err
}

func (r *Repository) ForWorkspace(ctx context.Context, ws string) ([]domain.Link, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+cols+` FROM share.links WHERE workspace_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Link{}
	for rows.Next() {
		l, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *l)
	}
	return out, rows.Err()
}
