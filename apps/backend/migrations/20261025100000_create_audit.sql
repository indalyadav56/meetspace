-- +goose Up
-- Audit log: who changed what, plus sign-in and security events.
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE audit.events (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    -- NULL for account-level events (sign-in, 2FA, password) that belong to no workspace.
    workspace_id UUID REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    route VARCHAR(200) NOT NULL DEFAULT '',
    entity_type VARCHAR(40) NOT NULL DEFAULT '',
    entity_id VARCHAR(80) NOT NULL DEFAULT '',
    summary VARCHAR(300) NOT NULL DEFAULT '',
    meta JSONB NOT NULL DEFAULT '{}',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(300) NOT NULL DEFAULT '',
    status SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_workspace ON audit.events (workspace_id, created_at DESC, id DESC);
CREATE INDEX idx_audit_actor ON audit.events (actor_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit.events (workspace_id, entity_type, entity_id);

-- +goose Down
DROP SCHEMA IF EXISTS audit CASCADE;
