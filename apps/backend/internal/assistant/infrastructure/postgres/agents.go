// Package postgres stores assistant agents.
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/assistant/domain"
)

type Agents struct{ db *sql.DB }

func NewAgents(db *sql.DB) *Agents { return &Agents{db: db} }

const cols = `id, workspace_id, name, description, instructions, icon, kind, enabled, created_by, created_at, updated_at,
	schedule, schedule_time, schedule_day, timezone, schedule_prompt, channel_id::text, next_run_at, last_run_at, last_result`

type row interface{ Scan(...any) error }

func scan(r row) (*domain.Agent, error) {
	var a domain.Agent
	var by, channel sql.NullString
	var next, last sql.NullTime
	if err := r.Scan(&a.ID, &a.WorkspaceID, &a.Name, &a.Description, &a.Instructions, &a.Icon, &a.Kind, &a.Enabled, &by, &a.CreatedAt, &a.UpdatedAt,
		&a.Schedule, &a.ScheduleTime, &a.ScheduleDay, &a.Timezone, &a.SchedulePrompt, &channel, &next, &last, &a.LastResult); err != nil {
		return nil, err
	}
	if by.Valid {
		a.CreatedBy = &by.String
	}
	if channel.Valid {
		a.ChannelID = &channel.String
	}
	if next.Valid {
		a.NextRunAt = &next.Time
	}
	if last.Valid {
		a.LastRunAt = &last.Time
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
		UPDATE assistant.agents SET name=$3, description=$4, instructions=$5, icon=$6, enabled=$7,
			schedule=$8, schedule_time=$9, schedule_day=$10, timezone=$11, schedule_prompt=$12, channel_id=$13::uuid, next_run_at=$14, updated_at=now()
		WHERE workspace_id=$1 AND id=$2 RETURNING updated_at`,
		a.WorkspaceID, a.ID, a.Name, a.Description, a.Instructions, a.Icon, a.Enabled,
		a.Schedule, a.ScheduleTime, a.ScheduleDay, a.Timezone, a.SchedulePrompt, a.ChannelID, a.NextRunAt).Scan(&a.UpdatedAt)
}

func (r *Agents) Due(ctx context.Context, now time.Time, limit int) ([]domain.Agent, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+cols+` FROM assistant.agents WHERE next_run_at IS NOT NULL AND next_run_at <= $1 AND enabled ORDER BY next_run_at LIMIT $2`, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Agent
	for rows.Next() {
		a, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

func (r *Agents) Claim(ctx context.Context, id string, from time.Time, next *time.Time) (bool, error) {
	res, err := r.db.ExecContext(ctx, `UPDATE assistant.agents SET next_run_at=$3 WHERE id=$1 AND next_run_at=$2`, id, from, next)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

func (r *Agents) SaveRun(ctx context.Context, id, result string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE assistant.agents SET last_run_at=$2, last_result=$3 WHERE id=$1`, id, at, result)
	return err
}

func (r *Agents) Delete(ctx context.Context, ws, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM assistant.agents WHERE workspace_id=$1 AND id=$2`, ws, id)
	return err
}
