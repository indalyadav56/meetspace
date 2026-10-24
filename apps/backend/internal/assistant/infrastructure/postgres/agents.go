// Package postgres stores assistant agents.
package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/assistant/domain"
)

type Agents struct{ db *sql.DB }

func NewAgents(db *sql.DB) *Agents { return &Agents{db: db} }

const cols = `id, workspace_id, name, description, instructions, icon, kind, enabled, created_by, created_at, updated_at`

type row interface{ Scan(...any) error }

func scan(r row) (*domain.Agent, error) {
	var a domain.Agent
	var by sql.NullString
	if err := r.Scan(&a.ID, &a.WorkspaceID, &a.Name, &a.Description, &a.Instructions, &a.Icon, &a.Kind, &a.Enabled, &by, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return nil, err
	}
	if by.Valid {
		a.CreatedBy = &by.String
	}
	return &a, nil
}

func (r *Agents) List(ctx context.Context, ws string) ([]domain.Agent, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+cols+` FROM assistant.agents WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Agent{}
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (r *Agents) Get(ctx context.Context, ws, id string) (*domain.Agent, error) {
	a, err := scan(r.db.QueryRowContext(ctx, `SELECT `+cols+` FROM assistant.agents WHERE workspace_id=$1 AND id=$2`, ws, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrAgentNotFound
	}
	return a, err
}

func (r *Agents) Create(ctx context.Context, a *domain.Agent) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO assistant.agents (id, workspace_id, name, description, instructions, icon, created_by, kind, enabled)
		VALUES (COALESCE(NULLIF($7, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6,$8,$9) RETURNING id, created_at, updated_at`,
		a.WorkspaceID, a.Name, a.Description, a.Instructions, a.Icon, a.CreatedBy, a.ID, a.Kind, a.Enabled).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *Agents) Update(ctx context.Context, a *domain.Agent) error {
	return r.db.QueryRowContext(ctx, `
		UPDATE assistant.agents SET name=$3, description=$4, instructions=$5, icon=$6, enabled=$7, updated_at=now()
		WHERE workspace_id=$1 AND id=$2 RETURNING updated_at`,
		a.WorkspaceID, a.ID, a.Name, a.Description, a.Instructions, a.Icon, a.Enabled).Scan(&a.UpdatedAt)
}

func (r *Agents) Delete(ctx context.Context, ws, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM assistant.agents WHERE workspace_id=$1 AND id=$2`, ws, id)
	return err
}
