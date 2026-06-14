-- +goose Up
CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT(now() AT TIME ZONE 'utc')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON auth.password_reset_tokens (token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON auth.password_reset_tokens (user_id);

-- +goose Down
DROP TABLE IF EXISTS auth.password_reset_tokens;
