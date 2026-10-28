-- +goose Up
-- Private iCalendar subscription URLs, one per person per workspace.
CREATE SCHEMA IF NOT EXISTS calendar;
CREATE TABLE calendar.feeds (
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    token VARCHAR(40) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_fetched_at TIMESTAMPTZ,
    PRIMARY KEY (workspace_id, user_id)
);

-- Email-to-task: each List can have a private address.
CREATE TABLE work.list_inboxes (
    list_id UUID PRIMARY KEY REFERENCES work.lists (id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    token VARCHAR(40) NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS work.list_inboxes;
DROP SCHEMA IF EXISTS calendar CASCADE;
