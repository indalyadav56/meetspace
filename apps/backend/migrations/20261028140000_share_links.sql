-- +goose Up
-- Public, read-only links to a Doc, List or Whiteboard.
CREATE SCHEMA IF NOT EXISTS share;
CREATE TABLE share.links (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    kind VARCHAR(12) NOT NULL CHECK (kind IN ('doc', 'list', 'whiteboard')),
    entity_id UUID NOT NULL,
    -- The link itself is the secret, like any "anyone with the link" URL.
    token VARCHAR(40) NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    views INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_links_entity ON share.links (workspace_id, kind, entity_id) WHERE revoked_at IS NULL;

-- +goose Down
DROP SCHEMA IF EXISTS share CASCADE;
