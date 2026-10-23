// Package postgres stores integration connections and links.
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/integrations/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/pgjson"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

const connCols = `workspace_id, provider, account_login, account_avatar, token_ciphertext, repos, webhook_secret, created_by, created_at, last_synced_at`

type row interface{ Scan(...any) error }

func scanConn(r row) (*domain.Connection, error) {
	var c domain.Connection
	var createdBy sql.NullString
	var synced sql.NullTime
	if err := r.Scan(&c.WorkspaceID, &c.Provider, &c.AccountLogin, &c.AccountAvatar, &c.TokenCiphertext, pgjson.Scan(&c.Repos), &c.WebhookSecret, &createdBy, &c.CreatedAt, &synced); err != nil {
		return nil, err
	}
	if createdBy.Valid {
		c.CreatedBy = &createdBy.String
	}
	if synced.Valid {
		c.LastSyncedAt = &synced.Time
	}
	if c.Repos == nil {
		c.Repos = []string{}
	}
	return &c, nil
}

func (r *Repository) GetConnection(ctx context.Context, ws, provider string) (*domain.Connection, error) {
	c, err := scanConn(r.db.QueryRowContext(ctx, `SELECT `+connCols+` FROM integrations.connections WHERE workspace_id=$1 AND provider=$2`, ws, provider))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *Repository) SaveConnection(ctx context.Context, c *domain.Connection) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO integrations.connections (workspace_id, provider, account_login, account_avatar, token_ciphertext, repos, webhook_secret, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (workspace_id, provider) DO UPDATE SET
			account_login=EXCLUDED.account_login, account_avatar=EXCLUDED.account_avatar, token_ciphertext=EXCLUDED.token_ciphertext,
			repos=EXCLUDED.repos, webhook_secret=EXCLUDED.webhook_secret
		RETURNING created_at`,
		c.WorkspaceID, c.Provider, c.AccountLogin, c.AccountAvatar, c.TokenCiphertext, pgjson.Value(c.Repos), c.WebhookSecret, c.CreatedBy).Scan(&c.CreatedAt)
}

func (r *Repository) DeleteConnection(ctx context.Context, ws, provider string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM integrations.connections WHERE workspace_id=$1 AND provider=$2`, ws, provider)
	return err
}

func (r *Repository) ListConnections(ctx context.Context, provider string) ([]domain.Connection, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+connCols+` FROM integrations.connections WHERE provider=$1`, provider)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Connection
	for rows.Next() {
		c, err := scanConn(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *Repository) MarkSynced(ctx context.Context, ws, provider string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE integrations.connections SET last_synced_at=$3 WHERE workspace_id=$1 AND provider=$2`, ws, provider, at)
	return err
}

const linkCols = `id, workspace_id, task_id, provider, kind, repo, number, ref, title, url, state, author, created_at, updated_at`

func scanLink(r row) (*domain.Link, error) {
	var l domain.Link
	if err := r.Scan(&l.ID, &l.WorkspaceID, &l.TaskID, &l.Provider, &l.Kind, &l.Repo, &l.Number, &l.Ref, &l.Title, &l.URL, &l.State, &l.Author, &l.CreatedAt, &l.UpdatedAt); err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *Repository) UpsertLink(ctx context.Context, l *domain.Link) (bool, string, error) {
	var prev sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT state FROM integrations.links WHERE task_id=$1 AND url=$2`, l.TaskID, l.URL).Scan(&prev)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, "", err
	}
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO integrations.links (workspace_id, task_id, provider, kind, repo, number, ref, title, url, state, author)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (task_id, url) DO UPDATE SET title=EXCLUDED.title, state=EXCLUDED.state, author=EXCLUDED.author, updated_at=now()
		RETURNING id, created_at, updated_at`,
		l.WorkspaceID, l.TaskID, l.Provider, l.Kind, l.Repo, l.Number, l.Ref, l.Title, l.URL, l.State, l.Author).Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return false, "", err
	}
	return !prev.Valid, prev.String, nil
}

func (r *Repository) ListLinks(ctx context.Context, ws, taskID string) ([]domain.Link, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+linkCols+` FROM integrations.links WHERE workspace_id=$1 AND task_id=$2 ORDER BY kind, created_at DESC`, ws, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Link{}
	for rows.Next() {
		l, err := scanLink(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *l)
	}
	return out, rows.Err()
}

func (r *Repository) GetLink(ctx context.Context, ws, id string) (*domain.Link, error) {
	l, err := scanLink(r.db.QueryRowContext(ctx, `SELECT `+linkCols+` FROM integrations.links WHERE workspace_id=$1 AND id=$2`, ws, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrLinkNotFound
	}
	return l, err
}

func (r *Repository) DeleteLink(ctx context.Context, ws, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM integrations.links WHERE workspace_id=$1 AND id=$2`, ws, id)
	return err
}
