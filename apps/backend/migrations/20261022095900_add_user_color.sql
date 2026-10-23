-- +goose Up
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS color VARCHAR(16) NOT NULL DEFAULT '#4f46e5';

-- +goose Down
ALTER TABLE auth.users DROP COLUMN IF EXISTS color;
