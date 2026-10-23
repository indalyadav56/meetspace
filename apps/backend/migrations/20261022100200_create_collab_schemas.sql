-- +goose Up
CREATE SCHEMA IF NOT EXISTS docs;

CREATE TABLE docs.docs (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    project_id UUID,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    emoji VARCHAR(16) NOT NULL DEFAULT '📄',
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_ws ON docs.docs (workspace_id);

CREATE TABLE docs.whiteboards (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled whiteboard',
    items JSONB NOT NULL DEFAULT '[]',
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_whiteboards_ws ON docs.whiteboards (workspace_id);

CREATE SCHEMA IF NOT EXISTS goals;

CREATE TABLE goals.goals (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color VARCHAR(16) NOT NULL,
    owner_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    due_date DATE,
    folder VARCHAR(120) NOT NULL DEFAULT 'Goals',
    targets JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_goals_ws ON goals.goals (workspace_id);

CREATE SCHEMA IF NOT EXISTS chat;

CREATE TABLE chat.channels (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL DEFAULT '',
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('channel', 'dm')),
    members JSONB NOT NULL DEFAULT '[]',
    topic TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_channels_ws ON chat.channels (workspace_id);

CREATE TABLE chat.messages (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES chat.channels (id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    parent_id UUID REFERENCES chat.messages (id) ON DELETE CASCADE,
    task_id UUID,
    clip_id UUID,
    call_id VARCHAR(80),
    reactions JSONB NOT NULL DEFAULT '{}',
    edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_channel ON chat.messages (channel_id, created_at);
CREATE INDEX idx_messages_ws ON chat.messages (workspace_id);

CREATE TABLE chat.read_state (
    channel_id UUID NOT NULL REFERENCES chat.channels (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (channel_id, user_id)
);

CREATE SCHEMA IF NOT EXISTS notify;

CREATE TABLE notify.notifications (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL,
    task_id UUID,
    actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    cleared BOOLEAN NOT NULL DEFAULT FALSE,
    important BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notify.notifications (workspace_id, user_id, created_at DESC);

CREATE TABLE notify.reminders (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    due TIMESTAMPTZ NOT NULL,
    task_id UUID,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    notified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_due ON notify.reminders (due) WHERE NOT done AND NOT notified;

-- +goose Down
DROP SCHEMA IF EXISTS notify CASCADE;
DROP SCHEMA IF EXISTS chat CASCADE;
DROP SCHEMA IF EXISTS goals CASCADE;
DROP SCHEMA IF EXISTS docs CASCADE;
