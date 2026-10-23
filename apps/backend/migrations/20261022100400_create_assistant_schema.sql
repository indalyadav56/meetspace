-- +goose Up
-- The AI assistant's conversation sessions are owned by Google ADK's database
-- session service; the migrator creates its tables inside this schema.
CREATE SCHEMA IF NOT EXISTS assistant;

-- +goose Down
DROP SCHEMA IF EXISTS assistant CASCADE;
