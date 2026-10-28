-- +goose Up
-- Two-factor authentication (TOTP). The secret is sealed with the server key.
ALTER TABLE auth.users
    ADD COLUMN totp_secret BYTEA,
    ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT false,
    -- SHA-256 hashes of unused recovery codes.
    ADD COLUMN totp_recovery JSONB NOT NULL DEFAULT '[]';

-- Where each session was opened from, for the "active sessions" list.
ALTER TABLE auth.refresh_tokens
    ADD COLUMN user_agent VARCHAR(300) NOT NULL DEFAULT '',
    ADD COLUMN ip VARCHAR(64) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON auth.refresh_tokens (user_id) WHERE NOT revoked;

-- Accounts linked through single sign-on.
CREATE TABLE auth.identities (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    provider VARCHAR(40) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, subject)
);
CREATE INDEX idx_identities_user ON auth.identities (user_id);

-- +goose Down
DROP TABLE IF EXISTS auth.identities;
DROP INDEX IF EXISTS auth.idx_refresh_tokens_user_active;
ALTER TABLE auth.refresh_tokens DROP COLUMN IF EXISTS ip, DROP COLUMN IF EXISTS user_agent;
ALTER TABLE auth.users DROP COLUMN IF EXISTS totp_recovery, DROP COLUMN IF EXISTS totp_enabled, DROP COLUMN IF EXISTS totp_secret;
