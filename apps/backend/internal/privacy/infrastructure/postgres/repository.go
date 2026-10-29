// Package postgres reads and removes one person's data across the schemas of
// the other contexts. It exists only for data-protection requests (export and
// erasure), which by nature cut across every context.
package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

// exports names each section of the export and the query that fills it; $1 is the user id.
var exports = []struct{ name, query string }{
	{"tasksCreated", `SELECT t.id, w.name AS workspace, t.key, t.title, t.description, t.created_at, t.updated_at
		FROM work.tasks t JOIN workspace.workspaces w ON w.id = t.workspace_id WHERE t.created_by = $1 ORDER BY t.created_at`},
	{"tasksAssigned", `SELECT t.id, w.name AS workspace, t.key, t.title, t.due_date FROM work.tasks t
		JOIN workspace.workspaces w ON w.id = t.workspace_id WHERE t.assignees @> to_jsonb(ARRAY[$1::text]) ORDER BY t.created_at`},
	{"comments", `SELECT c.id, c.task_id, c.text, c.created_at FROM work.comments c WHERE c.user_id = $1 ORDER BY c.created_at`},
	{"messages", `SELECT m.id, ch.name AS channel, m.text, m.edited, m.created_at FROM chat.messages m
		LEFT JOIN chat.channels ch ON ch.id = m.channel_id WHERE m.user_id = $1 ORDER BY m.created_at`},
	{"docs", `SELECT d.id, d.title, d.content, d.created_at, d.updated_at FROM docs.docs d WHERE d.created_by = $1 ORDER BY d.created_at`},
	{"timeEntries", `SELECT e.id, e.task_id, e.started_at, e.duration_min, e.note FROM work.time_entries e WHERE e.user_id = $1 ORDER BY e.started_at`},
	{"reminders", `SELECT r.id, r.text, r.due, r.done, r.created_at FROM notify.reminders r WHERE r.user_id = $1 ORDER BY r.created_at`},
	{"savedSearches", `SELECT s.name, s.query, s.created_at FROM search.saved_searches s WHERE s.user_id = $1`},
	{"notificationSettings", `SELECT p.* FROM notify.preferences p WHERE p.user_id = $1`},
	{"pushDevices", `SELECT p.user_agent, p.created_at, p.last_used_at FROM notify.push_subscriptions p WHERE p.user_id = $1`},
	{"calendarFeeds", `SELECT w.name AS workspace, f.created_at, f.last_fetched_at FROM calendar.feeds f
		JOIN workspace.workspaces w ON w.id = f.workspace_id WHERE f.user_id = $1`},
}

func (r *Repository) Content(ctx context.Context, userID string) (map[string]any, error) {
	out := make(map[string]any, len(exports))
	for _, e := range exports {
		var raw []byte
		// Postgres turns each row into JSON, so every section keeps its own shape.
		q := `SELECT COALESCE(json_agg(x), '[]') FROM (` + e.query + `) x`
		if err := r.db.QueryRowContext(ctx, q, userID).Scan(&raw); err != nil {
			return nil, fmt.Errorf("export %s: %w", e.name, err)
		}
		out[e.name] = json.RawMessage(raw)
	}
	return out, nil
}

// forget removes rows that only matter to the person themselves.
var forget = []string{
	`DELETE FROM notify.push_subscriptions WHERE user_id = $1`,
	`DELETE FROM notify.preferences WHERE user_id = $1`,
	`DELETE FROM notify.notifications WHERE user_id = $1`,
	`DELETE FROM notify.reminders WHERE user_id = $1`,
	`DELETE FROM calendar.feeds WHERE user_id = $1`,
	`DELETE FROM search.saved_searches WHERE user_id = $1`,
	`DELETE FROM chat.read_state WHERE user_id = $1`,
	`DELETE FROM work.timers WHERE user_id = $1`,
}

func (r *Repository) Forget(ctx context.Context, userID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck
	for _, q := range forget {
		if _, err := tx.ExecContext(ctx, q, userID); err != nil {
			return fmt.Errorf("%s: %w", q, err)
		}
	}
	return tx.Commit()
}
