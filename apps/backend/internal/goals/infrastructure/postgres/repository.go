// Package postgres implements the goals repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/goals/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/pgjson"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

const cols = `id, workspace_id, name, description, color, COALESCE(owner_id::text,''), due_date::text, folder, targets, created_at`

func scan(r interface{ Scan(...any) error }) (*domain.Goal, error) {
	var g domain.Goal
	var due sql.NullString
	if err := r.Scan(&g.ID, &g.WorkspaceID, &g.Name, &g.Description, &g.Color, &g.OwnerID, &due, &g.Folder, pgjson.Scan(&g.Targets), &g.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	if due.Valid {
		g.DueDate = &due.String
	}
	if g.Targets == nil {
		g.Targets = []domain.Target{}
	}
	return &g, nil
}

func nullable(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func (r *Repository) Create(ctx context.Context, g *domain.Goal) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO goals.goals (id, workspace_id, name, description, color, owner_id, due_date, folder, targets) VALUES (COALESCE(NULLIF($9, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
		g.WorkspaceID, g.Name, g.Description, g.Color, nullable(g.OwnerID), g.DueDate, g.Folder, pgjson.Value(g.Targets), g.ID).Scan(&g.ID, &g.CreatedAt)
}

func (r *Repository) Get(ctx context.Context, ws, id string) (*domain.Goal, error) {
	return scan(r.db.QueryRowContext(ctx, `SELECT `+cols+` FROM goals.goals WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) List(ctx context.Context, ws string) ([]domain.Goal, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+cols+` FROM goals.goals WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Goal
	for rows.Next() {
		g, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *g)
	}
	return out, rows.Err()
}

func (r *Repository) Update(ctx context.Context, g *domain.Goal) error {
	_, err := r.db.ExecContext(ctx, `UPDATE goals.goals SET name=$3, description=$4, color=$5, owner_id=$6, due_date=$7, folder=$8, targets=$9 WHERE workspace_id=$1 AND id=$2`,
		g.WorkspaceID, g.ID, g.Name, g.Description, g.Color, nullable(g.OwnerID), g.DueDate, g.Folder, pgjson.Value(g.Targets))
	return err
}

func (r *Repository) Delete(ctx context.Context, ws, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM goals.goals WHERE workspace_id=$1 AND id=$2`, ws, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrNotFound
	}
	return nil
}
