-- +goose Up
-- A short custom status (emoji + text) that teammates see, optionally clearing itself.
ALTER TABLE auth.users
    ADD COLUMN status_emoji VARCHAR(16) NOT NULL DEFAULT '',
    ADD COLUMN status_text VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN status_until TIMESTAMPTZ;

-- +goose Down
ALTER TABLE auth.users DROP COLUMN IF EXISTS status_until, DROP COLUMN IF EXISTS status_text, DROP COLUMN IF EXISTS status_emoji;
