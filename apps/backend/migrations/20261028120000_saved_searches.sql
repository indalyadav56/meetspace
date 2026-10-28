-- +goose Up
CREATE SCHEMA IF NOT EXISTS search;
CREATE TABLE search.saved_searches (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    query JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_searches_user ON search.saved_searches (workspace_id, user_id, created_at);

-- +goose Down
DROP SCHEMA IF EXISTS search CASCADE;
