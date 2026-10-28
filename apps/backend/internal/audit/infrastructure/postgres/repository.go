// Package postgres stores audit events.
package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/audit/domain"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Insert(ctx context.Context, e *domain.Event) error {
	meta, err := json.Marshal(e.Meta)
	if err != nil || e.Meta == nil {
		meta = []byte("{}")
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO audit.events (workspace_id, actor_id, action, route, entity_type, entity_id, summary, meta, ip, user_agent, status, created_at)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::text,
			-- A delete has no body to name the item; reuse the name from its earlier events.
			COALESCE(NULLIF($7::text, ''), (SELECT summary FROM audit.events WHERE workspace_id = $1::uuid AND entity_id = $6::text AND $6::text <> '' AND summary <> '' ORDER BY id DESC LIMIT 1), ''),
			$8, $9, $10, $11, $12) RETURNING id`,
		e.WorkspaceID, e.ActorID, e.Action, e.Route, e.EntityType, e.EntityID, e.Summary, meta, e.IP, e.UserAgent, e.Status, e.CreatedAt).Scan(&e.ID)
}

func (r *Repository) List(ctx context.Context, f domain.Filter) ([]domain.Event, error) {
	var where []string
	var args []any
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }

	switch {
	case f.WorkspaceID != "" && f.Security:
		ws := arg(f.WorkspaceID)
		where = append(where, fmt.Sprintf(`(workspace_id = %s::uuid OR (workspace_id IS NULL AND actor_id IN (SELECT user_id FROM workspace.members WHERE workspace_id = %s::uuid)))`, ws, ws))
	case f.WorkspaceID != "":
		where = append(where, "workspace_id = "+arg(f.WorkspaceID)+"::uuid")
	default:
		where = append(where, "workspace_id IS NULL")
	}
	if f.ActorID != "" {
		where = append(where, "actor_id = "+arg(f.ActorID)+"::uuid")
	}
	if f.Action != "" {
		if strings.HasSuffix(f.Action, ".") {
			where = append(where, "action LIKE "+arg(strings.NewReplacer("%", `\%`, "_", `\_`).Replace(f.Action)+"%"))
		} else {
			where = append(where, "action = "+arg(f.Action))
		}
	}
	if f.EntityType != "" {
		where = append(where, "entity_type = "+arg(f.EntityType))
	}
	if f.EntityID != "" {
		where = append(where, "entity_id = "+arg(f.EntityID))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		p := arg("%" + strings.NewReplacer("%", `\%`, "_", `\_`).Replace(q) + "%")
		where = append(where, fmt.Sprintf("(summary ILIKE %s OR action ILIKE %s OR ip ILIKE %s)", p, p, p))
	}
	if f.From != nil {
		where = append(where, "created_at >= "+arg(*f.From))
	}
	if f.To != nil {
		where = append(where, "created_at < "+arg(*f.To))
	}
	if f.Before != "" {
		// uuidv7 ids sort by time, so the id alone is a stable cursor.
		where = append(where, "id < "+arg(f.Before)+"::uuid")
	}
	q := `SELECT id, workspace_id, actor_id, action, route, entity_type, entity_id, summary, meta, ip, user_agent, status, created_at
		FROM audit.events WHERE ` + strings.Join(where, " AND ") + ` ORDER BY id DESC LIMIT ` + arg(f.Limit)
	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Event{}
	for rows.Next() {
		var e domain.Event
		var ws, actor sql.NullString
		var meta []byte
		if err := rows.Scan(&e.ID, &ws, &actor, &e.Action, &e.Route, &e.EntityType, &e.EntityID, &e.Summary, &meta, &e.IP, &e.UserAgent, &e.Status, &e.CreatedAt); err != nil {
			return nil, err
		}
		if ws.Valid {
			e.WorkspaceID = &ws.String
		}
		if actor.Valid {
			e.ActorID = &actor.String
		}
		if len(meta) > 2 {
			_ = json.Unmarshal(meta, &e.Meta)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *Repository) Actions(ctx context.Context, workspaceID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT DISTINCT action FROM audit.events WHERE workspace_id = $1::uuid ORDER BY action`, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *Repository) Purge(ctx context.Context, before time.Time) (int64, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM audit.events WHERE created_at < $1`, before)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
