-- +goose Up
-- Email and browser-push delivery for notifications.
ALTER TABLE notify.notifications
    ADD COLUMN pushed_at TIMESTAMPTZ,
    ADD COLUMN emailed_at TIMESTAMPTZ;
CREATE INDEX idx_notifications_undelivered ON notify.notifications (created_at)
    WHERE pushed_at IS NULL OR emailed_at IS NULL;

-- One row per person; missing rows mean the defaults (daily digest at 08:00 UTC, push on).
CREATE TABLE notify.preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email_mode VARCHAR(10) NOT NULL DEFAULT 'digest' CHECK (email_mode IN ('instant', 'digest', 'off')),
    email_kinds JSONB NOT NULL DEFAULT '["mention","assigned","comment","due","reminder","timesheet"]',
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    push_kinds JSONB NOT NULL DEFAULT '["mention","assigned","comment","due","reminder","status","timesheet"]',
    digest_hour SMALLINT NOT NULL DEFAULT 8 CHECK (digest_hour BETWEEN 0 AND 23),
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    -- quiet hours in the person's timezone; -1 means none
    quiet_start SMALLINT NOT NULL DEFAULT -1 CHECK (quiet_start BETWEEN -1 AND 23),
    quiet_end SMALLINT NOT NULL DEFAULT -1 CHECK (quiet_end BETWEEN -1 AND 23),
    -- set by "Mute notifications"; push and instant email wait until then
    paused_until TIMESTAMPTZ,
    last_digest_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notify.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent VARCHAR(300) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_push_subscriptions_user ON notify.push_subscriptions (user_id);

-- The server's VAPID key pair, generated on first use.
CREATE TABLE notify.vapid (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS notify.vapid;
DROP TABLE IF EXISTS notify.push_subscriptions;
DROP TABLE IF EXISTS notify.preferences;
DROP INDEX IF EXISTS notify.idx_notifications_undelivered;
ALTER TABLE notify.notifications DROP COLUMN IF EXISTS emailed_at, DROP COLUMN IF EXISTS pushed_at;
