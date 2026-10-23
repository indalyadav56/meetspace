// Package postgres implements the chat repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/chat/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/pgjson"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

type row interface{ Scan(...any) error }

const chCols = `id, workspace_id, name, kind, members, topic, created_at`

func scanChannel(r row) (*domain.Channel, error) {
	var c domain.Channel
	if err := r.Scan(&c.ID, &c.WorkspaceID, &c.Name, &c.Kind, pgjson.Scan(&c.Members), &c.Topic, &c.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrChannelNotFound
		}
		return nil, err
	}
	if c.Members == nil {
		c.Members = []string{}
	}
	return &c, nil
}

func (r *Repository) CreateChannel(ctx context.Context, c *domain.Channel) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO chat.channels (id, workspace_id, name, kind, members, topic) VALUES (COALESCE(NULLIF($6, '')::uuid, uuidv7()), $1,$2,$3,$4,$5) RETURNING id, created_at`,
		c.WorkspaceID, c.Name, c.Kind, pgjson.Value(c.Members), c.Topic, c.ID).Scan(&c.ID, &c.CreatedAt)
}

func (r *Repository) GetChannel(ctx context.Context, ws, id string) (*domain.Channel, error) {
	return scanChannel(r.db.QueryRowContext(ctx, `SELECT `+chCols+` FROM chat.channels WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) ListChannels(ctx context.Context, ws string) ([]domain.Channel, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+chCols+` FROM chat.channels WHERE workspace_id=$1 ORDER BY kind, created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Channel
	for rows.Next() {
		c, err := scanChannel(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *Repository) FindDM(ctx context.Context, ws, a, b string) (*domain.Channel, error) {
	return scanChannel(r.db.QueryRowContext(ctx, `SELECT `+chCols+` FROM chat.channels
		WHERE workspace_id=$1 AND kind='dm' AND members ? $2 AND members ? $3 LIMIT 1`, ws, a, b))
}

const msgCols = `id, channel_id, COALESCE(user_id::text,''), text, created_at, parent_id::text, task_id::text, clip_id::text, call_id, reactions, edited`

func scanMessage(r row) (*domain.Message, error) {
	var m domain.Message
	var parent, task, clip, call sql.NullString
	if err := r.Scan(&m.ID, &m.ChannelID, &m.UserID, &m.Text, &m.CreatedAt, &parent, &task, &clip, &call, pgjson.Scan(&m.Reactions), &m.Edited); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMessageNotFound
		}
		return nil, err
	}
	str := func(ns sql.NullString) *string {
		if !ns.Valid {
			return nil
		}
		v := ns.String
		return &v
	}
	m.ParentID, m.TaskID, m.ClipID, m.CallID = str(parent), str(task), str(clip), str(call)
	if m.Reactions == nil {
		m.Reactions = map[string][]string{}
	}
	return &m, nil
}

func reactionsValue(m map[string][]string) any {
	if len(m) == 0 {
		return []byte("{}")
	}
	return pgjson.Value(m)
}

func (r *Repository) CreateMessage(ctx context.Context, ws string, m *domain.Message) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO chat.messages (id, workspace_id, channel_id, user_id, text, parent_id, task_id, clip_id, call_id, reactions)
		VALUES (COALESCE(NULLIF($10, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
		ws, m.ChannelID, m.UserID, m.Text, m.ParentID, m.TaskID, m.ClipID, m.CallID, reactionsValue(m.Reactions), m.ID).Scan(&m.ID, &m.CreatedAt)
}

func (r *Repository) GetMessage(ctx context.Context, ws, id string) (*domain.Message, error) {
	return scanMessage(r.db.QueryRowContext(ctx, `SELECT `+msgCols+` FROM chat.messages WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) UpdateMessage(ctx context.Context, ws string, m *domain.Message) error {
	_, err := r.db.ExecContext(ctx, `UPDATE chat.messages SET text=$3, task_id=$4, reactions=$5, edited=$6 WHERE workspace_id=$1 AND id=$2`,
		ws, m.ID, m.Text, m.TaskID, reactionsValue(m.Reactions), m.Edited)
	return err
}

func (r *Repository) DeleteMessage(ctx context.Context, ws, id string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `DELETE FROM chat.messages WHERE workspace_id=$1 AND (id=$2 OR parent_id=$2) RETURNING id`, ws, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var x string
		if err := rows.Scan(&x); err != nil {
			return nil, err
		}
		ids = append(ids, x)
	}
	if len(ids) == 0 {
		return nil, domain.ErrMessageNotFound
	}
	return ids, rows.Err()
}

func (r *Repository) RecentMessages(ctx context.Context, ws string, channelIDs []string, perChannel int) ([]domain.Message, error) {
	if len(channelIDs) == 0 {
		return nil, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		WITH top AS (
		  SELECT id FROM (
		    SELECT id, row_number() OVER (PARTITION BY channel_id ORDER BY created_at DESC) rn
		    FROM chat.messages WHERE workspace_id=$1 AND parent_id IS NULL AND channel_id::text = ANY(string_to_array($2, ','))
		  ) x WHERE rn <= $3
		)
		SELECT `+msgCols+` FROM chat.messages
		WHERE workspace_id=$1 AND (id IN (SELECT id FROM top) OR parent_id IN (SELECT id FROM top))
		ORDER BY created_at`, ws, strings.Join(channelIDs, ","), perChannel)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Message
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (r *Repository) SetRead(ctx context.Context, channelID, userID string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO chat.read_state (channel_id, user_id, last_read_at) VALUES ($1,$2,$3)
		ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = GREATEST(chat.read_state.last_read_at, EXCLUDED.last_read_at)`, channelID, userID, at)
	return err
}

func (r *Repository) ReadState(ctx context.Context, ws, userID string) (map[string]time.Time, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT rs.channel_id, rs.last_read_at FROM chat.read_state rs
		JOIN chat.channels c ON c.id = rs.channel_id WHERE c.workspace_id=$1 AND rs.user_id=$2`, ws, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]time.Time{}
	for rows.Next() {
		var id string
		var at time.Time
		if err := rows.Scan(&id, &at); err != nil {
			return nil, err
		}
		out[id] = at
	}
	return out, rows.Err()
}
