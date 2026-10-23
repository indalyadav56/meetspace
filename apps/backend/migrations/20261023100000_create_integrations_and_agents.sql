-- +goose Up
CREATE SCHEMA IF NOT EXISTS integrations;

-- One connected account per provider per workspace. Tokens are encrypted by the app.
CREATE TABLE integrations.connections (
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    account_login VARCHAR(255) NOT NULL,
    account_avatar TEXT NOT NULL DEFAULT '',
    token_ciphertext BYTEA NOT NULL,
    repos JSONB NOT NULL DEFAULT '[]',
    webhook_secret VARCHAR(64) NOT NULL,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at TIMESTAMPTZ,
    PRIMARY KEY (workspace_id, provider)
);

-- Pull requests, issues and commits linked to tasks.
CREATE TABLE integrations.links (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES work.tasks (id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('pull_request', 'issue', 'commit')),
    repo VARCHAR(255) NOT NULL,
    number INT NOT NULL DEFAULT 0,
    ref VARCHAR(64) NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'open',
    author VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, url)
);
CREATE INDEX idx_integration_links_task ON integrations.links (workspace_id, task_id);

-- Saved assistant personas: a name plus standing instructions.
CREATE TABLE assistant.agents (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    icon VARCHAR(16) NOT NULL DEFAULT '✨',
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_agents_ws ON assistant.agents (workspace_id);

-- +goose Down
DROP TABLE IF EXISTS assistant.agents;
DROP SCHEMA IF EXISTS integrations CASCADE;
