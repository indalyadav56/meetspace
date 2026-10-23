-- +goose Up
CREATE SCHEMA IF NOT EXISTS workspace;

CREATE TABLE workspace.workspaces (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    name VARCHAR(120) NOT NULL,
    color VARCHAR(16) NOT NULL DEFAULT '#4f46e5',
    -- monotonically increasing task number shown as MS-<n>
    next_task_key BIGINT NOT NULL DEFAULT 100,
    created_by UUID NOT NULL REFERENCES auth.users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE workspace.members (
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
    invited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_members_user ON workspace.members (user_id);

-- +goose Down
DROP SCHEMA IF EXISTS workspace CASCADE;
