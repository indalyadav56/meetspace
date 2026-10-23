// Package postgres implements the workspace repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
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
	rows, err := r.db.QueryContext(ctx, `SELECT user_id, role, invited, title, manager_id FROM workspace.members WHERE workspace_id=$1 ORDER BY created_at`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Member
	for rows.Next() {
		var m domain.Member
		if err := rows.Scan(&m.UserID, &m.Role, &m.Invited, &m.Title, &m.ManagerID); err != nil {
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

func (r *Repository) AllIDs(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id FROM workspace.workspaces WHERE deleted_at IS NULL ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
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

func (r *Repository) SetMemberProfile(ctx context.Context, workspaceID, userID, title string, managerID *string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE workspace.members SET title=$3, manager_id=$4 WHERE workspace_id=$1 AND user_id=$2`, workspaceID, userID, title, managerID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrNotMember
	}
	return nil
}

const teamCols = `t.id, t.name, t.color, t.description, t.lead_id, COALESCE(t.created_by::text, ''), t.created_at, t.updated_at,
	COALESCE((SELECT json_agg(tm.user_id ORDER BY tm.user_id) FROM workspace.team_members tm WHERE tm.team_id = t.id), '[]')::text`

func scanTeam(sc interface{ Scan(...any) error }, t *domain.Team) error {
	var members string
	if err := sc.Scan(&t.ID, &t.Name, &t.Color, &t.Description, &t.LeadID, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt, &members); err != nil {
		return err
	}
	t.Members = []string{}
	return json.Unmarshal([]byte(members), &t.Members)
}

func (r *Repository) ListTeams(ctx context.Context, workspaceID string) ([]domain.Team, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+teamCols+` FROM workspace.teams t WHERE t.workspace_id=$1 ORDER BY t.name`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Team{}
	for rows.Next() {
		t := domain.Team{WorkspaceID: workspaceID}
		if err := scanTeam(rows, &t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *Repository) GetTeam(ctx context.Context, workspaceID, id string) (*domain.Team, error) {
	t := domain.Team{WorkspaceID: workspaceID}
	err := scanTeam(r.db.QueryRowContext(ctx, `SELECT `+teamCols+` FROM workspace.teams t WHERE t.workspace_id=$1 AND t.id=$2`, workspaceID, id), &t)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrTeamNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) SaveTeam(ctx context.Context, t *domain.Team) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO workspace.teams (id, workspace_id, name, color, description, lead_id, created_by)
		VALUES (COALESCE(NULLIF($1, '')::uuid, uuidv7()), $2, $3, $4, $5, $6, NULLIF($7, '')::uuid)
		ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, color=EXCLUDED.color, description=EXCLUDED.description, lead_id=EXCLUDED.lead_id, updated_at=now()
		WHERE workspace.teams.workspace_id = EXCLUDED.workspace_id
		RETURNING id`,
		t.ID, t.WorkspaceID, t.Name, t.Color, t.Description, t.LeadID, t.CreatedBy).Scan(&t.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.ErrTeamNotFound
		}
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM workspace.team_members WHERE team_id=$1`, t.ID); err != nil {
		return err
	}
	if len(t.Members) > 0 {
		ids, _ := json.Marshal(t.Members)
		if _, err := tx.ExecContext(ctx, `INSERT INTO workspace.team_members (team_id, user_id) SELECT $1, x::uuid FROM jsonb_array_elements_text($2::jsonb) x ON CONFLICT DO NOTHING`, t.ID, string(ids)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) DeleteTeam(ctx context.Context, workspaceID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM workspace.teams WHERE workspace_id=$1 AND id=$2`, workspaceID, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrTeamNotFound
	}
	return nil
}
