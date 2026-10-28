package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
)

// Delivery stores preferences and push subscriptions and claims notifications
// for sending. Claims use SKIP LOCKED so several workers never double-send.
type Delivery struct{ db *sql.DB }

func NewDelivery(db *sql.DB) *Delivery { return &Delivery{db: db} }

const prefCols = `COALESCE(p.email_mode,'digest'), COALESCE(p.email_kinds,'["mention","assigned","comment","due","reminder","timesheet"]'),
	COALESCE(p.push_enabled,true), COALESCE(p.push_kinds,'["mention","assigned","comment","due","reminder","status","timesheet"]'),
	COALESCE(p.digest_hour,8), COALESCE(p.timezone,'UTC'), COALESCE(p.quiet_start,-1), COALESCE(p.quiet_end,-1), p.paused_until`

func scanPrefs(dst *domain.Preferences, emailKinds, pushKinds []byte, paused sql.NullTime) {
	_ = json.Unmarshal(emailKinds, &dst.EmailKinds)
	_ = json.Unmarshal(pushKinds, &dst.PushKinds)
	if paused.Valid {
		dst.PausedUntil = &paused.Time
	}
}

func (d *Delivery) Preferences(ctx context.Context, userID string) (domain.Preferences, error) {
	var p domain.Preferences
	var ek, pk []byte
	var paused sql.NullTime
	err := d.db.QueryRowContext(ctx, `SELECT `+prefCols+` FROM (SELECT $1::uuid AS uid) x LEFT JOIN notify.preferences p ON p.user_id = x.uid`, userID).
		Scan(&p.EmailMode, &ek, &p.PushEnabled, &pk, &p.DigestHour, &p.Timezone, &p.QuietStart, &p.QuietEnd, &paused)
	if err != nil {
		return p, err
	}
	scanPrefs(&p, ek, pk, paused)
	return p, nil
}

func (d *Delivery) SavePreferences(ctx context.Context, userID string, p domain.Preferences) error {
	ek, _ := json.Marshal(p.EmailKinds)
	pk, _ := json.Marshal(p.PushKinds)
	_, err := d.db.ExecContext(ctx, `
		INSERT INTO notify.preferences (user_id, email_mode, email_kinds, push_enabled, push_kinds, digest_hour, timezone, quiet_start, quiet_end, paused_until, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
		ON CONFLICT (user_id) DO UPDATE SET email_mode=EXCLUDED.email_mode, email_kinds=EXCLUDED.email_kinds, push_enabled=EXCLUDED.push_enabled,
			push_kinds=EXCLUDED.push_kinds, digest_hour=EXCLUDED.digest_hour, timezone=EXCLUDED.timezone, quiet_start=EXCLUDED.quiet_start,
			quiet_end=EXCLUDED.quiet_end, paused_until=EXCLUDED.paused_until, updated_at=now()`,
		userID, p.EmailMode, ek, p.PushEnabled, pk, p.DigestHour, p.Timezone, p.QuietStart, p.QuietEnd, p.PausedUntil)
	return err
}

func (d *Delivery) SaveSubscription(ctx context.Context, s domain.PushSubscription) error {
	// The same browser endpoint moves to whoever signed in last.
	_, err := d.db.ExecContext(ctx, `
		INSERT INTO notify.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1,$2,$3,$4,$5)
		ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, user_agent=EXCLUDED.user_agent`,
		s.UserID, s.Endpoint, s.P256dh, s.Auth, s.UserAgent)
	return err
}

func (d *Delivery) DeleteSubscription(ctx context.Context, userID, endpoint string) error {
	q, args := `DELETE FROM notify.push_subscriptions WHERE endpoint=$1`, []any{endpoint}
	if userID != "" {
		q, args = q+` AND user_id=$2`, append(args, userID)
	}
	_, err := d.db.ExecContext(ctx, q, args...)
	return err
}

func (d *Delivery) Subscriptions(ctx context.Context, userID string) ([]domain.PushSubscription, error) {
	rows, err := d.db.QueryContext(ctx, `SELECT id, user_id, endpoint, p256dh, auth, user_agent FROM notify.push_subscriptions WHERE user_id=$1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.PushSubscription{}
	for rows.Next() {
		var s domain.PushSubscription
		if err := rows.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256dh, &s.Auth, &s.UserAgent); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (d *Delivery) TouchSubscription(ctx context.Context, id string) error {
	_, err := d.db.ExecContext(ctx, `UPDATE notify.push_subscriptions SET last_used_at=now() WHERE id=$1`, id)
	return err
}

func (d *Delivery) VAPID(ctx context.Context, generate func() (string, string, error)) (string, string, error) {
	var pub, priv string
	err := d.db.QueryRowContext(ctx, `SELECT public_key, private_key FROM notify.vapid WHERE id=1`).Scan(&pub, &priv)
	if err == nil {
		return pub, priv, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", "", err
	}
	if pub, priv, err = generate(); err != nil {
		return "", "", err
	}
	// Another process may have won the race; whichever row exists is the one to use.
	if _, err := d.db.ExecContext(ctx, `INSERT INTO notify.vapid (id, public_key, private_key) VALUES (1,$1,$2) ON CONFLICT (id) DO NOTHING`, pub, priv); err != nil {
		return "", "", err
	}
	err = d.db.QueryRowContext(ctx, `SELECT public_key, private_key FROM notify.vapid WHERE id=1`).Scan(&pub, &priv)
	return pub, priv, err
}

// outgoing joins a claimed set of notifications with what rendering needs.
const outgoing = `
	SELECT c.id, c.workspace_id, c.user_id, c.kind, COALESCE(c.task_id::text,''), COALESCE(c.actor_id::text,''), c.text, c.read, c.cleared, c.important, c.created_at,
		w.name, u.full_name, u.email, COALESCE(a.full_name,''), COALESCE(t.title,''), COALESCE(t.key,0), ` + prefCols + `
	FROM claimed c
	JOIN auth.users u ON u.id = c.user_id
	JOIN workspace.workspaces w ON w.id = c.workspace_id
	LEFT JOIN auth.users a ON a.id = c.actor_id
	LEFT JOIN work.tasks t ON t.id = c.task_id
	LEFT JOIN notify.preferences p ON p.user_id = c.user_id
	ORDER BY c.created_at`

func (d *Delivery) query(ctx context.Context, q string, args ...any) ([]domain.Outgoing, error) {
	rows, err := d.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Outgoing
	for rows.Next() {
		var o domain.Outgoing
		var ek, pk []byte
		var paused sql.NullTime
		n := &o.Notification
		if err := rows.Scan(&n.ID, &n.WorkspaceID, &n.UserID, &n.Kind, &n.TaskID, &n.ActorID, &n.Text, &n.Read, &n.Cleared, &n.Important, &n.CreatedAt,
			&o.WorkspaceName, &o.RecipientName, &o.RecipientMail, &o.ActorName, &o.TaskTitle, &o.TaskKey,
			&o.Prefs.EmailMode, &ek, &o.Prefs.PushEnabled, &pk, &o.Prefs.DigestHour, &o.Prefs.Timezone, &o.Prefs.QuietStart, &o.Prefs.QuietEnd, &paused); err != nil {
			return nil, err
		}
		scanPrefs(&o.Prefs, ek, pk, paused)
		out = append(out, o)
	}
	return out, rows.Err()
}

func (d *Delivery) ClaimPush(ctx context.Context, before time.Time, limit int) ([]domain.Outgoing, error) {
	return d.query(ctx, `
		WITH claimed AS (
			UPDATE notify.notifications SET pushed_at = now()
			WHERE id IN (SELECT id FROM notify.notifications
				WHERE pushed_at IS NULL AND created_at < $1 AND created_at > now() - interval '1 day'
				ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED)
			RETURNING *)`+outgoing, before, limit)
}

func (d *Delivery) ClaimInstantEmail(ctx context.Context, before time.Time, limit int) ([]domain.Outgoing, error) {
	return d.query(ctx, `
		WITH claimed AS (
			UPDATE notify.notifications SET emailed_at = now()
			WHERE id IN (SELECT n.id FROM notify.notifications n
				JOIN notify.preferences p ON p.user_id = n.user_id AND p.email_mode = 'instant'
				WHERE n.emailed_at IS NULL AND NOT n.read AND NOT n.cleared
				  AND n.created_at < $1 AND n.created_at > now() - interval '1 day'
				  AND (p.paused_until IS NULL OR p.paused_until < now())
				ORDER BY n.created_at LIMIT $2 FOR UPDATE OF n SKIP LOCKED)
			RETURNING *)`+outgoing, before, limit)
}

func (d *Delivery) DigestRecipients(ctx context.Context, now time.Time) ([]string, error) {
	rows, err := d.db.QueryContext(ctx, `
		SELECT DISTINCT n.user_id::text FROM notify.notifications n
		LEFT JOIN notify.preferences p ON p.user_id = n.user_id
		WHERE n.emailed_at IS NULL AND NOT n.read AND NOT n.cleared AND n.created_at > $1::timestamptz - interval '1 day'
		  AND COALESCE(p.email_mode, 'digest') = 'digest'
		  AND extract(hour FROM $1::timestamptz AT TIME ZONE COALESCE(p.timezone, 'UTC')) = COALESCE(p.digest_hour, 8)
		  AND (p.last_digest_at IS NULL OR p.last_digest_at < $1::timestamptz - interval '20 hours')
		LIMIT 500`, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (d *Delivery) ClaimDigest(ctx context.Context, userID string, now time.Time) ([]domain.Outgoing, error) {
	if _, err := d.db.ExecContext(ctx, `
		INSERT INTO notify.preferences (user_id, last_digest_at) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET last_digest_at = EXCLUDED.last_digest_at`, userID, now); err != nil {
		return nil, err
	}
	return d.query(ctx, `
		WITH claimed AS (
			UPDATE notify.notifications SET emailed_at = now()
			WHERE id IN (SELECT id FROM notify.notifications
				WHERE user_id = $1 AND emailed_at IS NULL AND NOT read AND NOT cleared AND created_at > $2::timestamptz - interval '1 day'
				ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED)
			RETURNING *)`+outgoing, userID, now)
}

func (d *Delivery) DueTasks(ctx context.Context, userID, today string) ([]domain.DueTask, error) {
	rows, err := d.db.QueryContext(ctx, `
		SELECT t.id::text, t.key, t.title, to_char(t.due_date, 'YYYY-MM-DD'), t.due_date < $2::date, l.name
		FROM work.tasks t
		JOIN work.lists l ON l.id = t.list_id
		JOIN work.projects pr ON pr.id = l.project_id
		WHERE t.assignees ? $1 AND t.deleted_at IS NULL AND t.due_date IS NOT NULL AND t.due_date <= $2::date
		  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pr.statuses) s WHERE s->>'id' = t.status_id AND s->>'type' IN ('done','closed'))
		ORDER BY t.due_date, t.key LIMIT 20`, userID, today)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.DueTask
	for rows.Next() {
		var t domain.DueTask
		if err := rows.Scan(&t.ID, &t.Key, &t.Title, &t.DueDate, &t.Overdue, &t.ListName); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
