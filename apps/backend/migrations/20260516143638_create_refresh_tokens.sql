-- +goose Up
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    token VARCHAR(512) NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    parent VARCHAR(512) DEFAULT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT(now() AT TIME ZONE 'utc'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT(now() AT TIME ZONE 'utc')
);

-- Lookup by token hash must be unique and fast.
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token ON auth.refresh_tokens (token);

-- Revocation queries filter by session or user.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session ON auth.refresh_tokens (session_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON auth.refresh_tokens (user_id);

-- +goose Down
DROP TABLE IF EXISTS auth.refresh_tokens;
