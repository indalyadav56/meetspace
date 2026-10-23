// Package postgres implements the workspace repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, w *domain.Workspace, owner string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO workspace.workspaces (id, name, color, created_by) VALUES (COALESCE(NULLIF($4, '')::uuid, uuidv7()), $1,$2,$3) RETURNING id, created_at`,
		w.Name, w.Color, w.CreatedBy, w.ID).Scan(&w.ID, &w.CreatedAt); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO workspace.members (workspace_id, user_id, role) VALUES ($1,$2,'owner')`, w.ID, owner); err != nil {
		return err
	}
	w.Members = []domain.Member{{UserID: owner, Role: domain.RoleOwner}}
	return tx.Commit()
}

func (r *Repository) members(ctx context.Context, id string) ([]domain.Member, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT user_id, role, invited FROM workspace.members WHERE workspace_id=$1 ORDER BY created_at`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Member
	for rows.Next() {
		var m domain.Member
		if err := rows.Scan(&m.UserID, &m.Role, &m.Invited); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) Get(ctx context.Context, id string) (*domain.Workspace, error) {
	var w domain.Workspace
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, color, created_by, created_at FROM workspace.workspaces WHERE id=$1 AND deleted_at IS NULL`, id).
		Scan(&w.ID, &w.Name, &w.Color, &w.CreatedBy, &w.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if w.Members, err = r.members(ctx, id); err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *Repository) ListForUser(ctx context.Context, userID string) ([]domain.Workspace, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT w.id FROM workspace.workspaces w
		JOIN workspace.members m ON m.workspace_id = w.id
		WHERE m.user_id=$1 AND w.deleted_at IS NULL ORDER BY w.created_at`, userID)
	if err != nil {
		return nil, err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	out := make([]domain.Workspace, 0, len(ids))
	for _, id := range ids {
		w, err := r.Get(ctx, id)
		if err != nil {
			return nil, err
		}
		out = append(out, *w)
	}
	return out, nil
}

func (r *Repository) Update(ctx context.Context, w *domain.Workspace) error {
	_, err := r.db.ExecContext(ctx, `UPDATE workspace.workspaces SET name=$2, color=$3, updated_at=now() WHERE id=$1`, w.ID, w.Name, w.Color)
	return err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE workspace.workspaces SET deleted_at=now() WHERE id=$1`, id)
	return err
}

func (r *Repository) Role(ctx context.Context, workspaceID, userID string) (domain.Role, error) {
	var role domain.Role
	err := r.db.QueryRowContext(ctx, `
		SELECT m.role FROM workspace.members m JOIN workspace.workspaces w ON w.id = m.workspace_id
		WHERE m.workspace_id=$1 AND m.user_id=$2 AND w.deleted_at IS NULL`, workspaceID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrNotMember
	}
	return role, err
}

func (r *Repository) UpsertMember(ctx context.Context, workspaceID string, m domain.Member) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO workspace.members (workspace_id, user_id, role, invited) VALUES ($1,$2,$3,$4)
		ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		workspaceID, m.UserID, m.Role, m.Invited)
	return err
}

func (r *Repository) RemoveMember(ctx context.Context, workspaceID, userID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM workspace.members WHERE workspace_id=$1 AND user_id=$2`, workspaceID, userID)
	return err
}

func (r *Repository) CountOwners(ctx context.Context, workspaceID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM workspace.members WHERE workspace_id=$1 AND role='owner'`, workspaceID).Scan(&n)
	return n, err
}

func (r *Repository) NextTaskKey(ctx context.Context, workspaceID string) (int64, error) {
	var k int64
	err := r.db.QueryRowContext(ctx,
		`UPDATE workspace.workspaces SET next_task_key = next_task_key + 1 WHERE id=$1 RETURNING next_task_key - 1`, workspaceID).Scan(&k)
	return k, err
}
