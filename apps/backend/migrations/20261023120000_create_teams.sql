-- +goose Up
-- Job title and reporting line for the org chart.
ALTER TABLE workspace.members
    ADD COLUMN title VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN manager_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

-- Groups of people inside a workspace (Design, Platform...).
CREATE TABLE workspace.teams (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#0b7f71',
    description TEXT NOT NULL DEFAULT '',
    lead_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teams_workspace ON workspace.teams (workspace_id, name);

CREATE TABLE workspace.team_members (
    team_id UUID NOT NULL REFERENCES workspace.teams (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS workspace.team_members;
DROP TABLE IF EXISTS workspace.teams;
ALTER TABLE workspace.members DROP COLUMN IF EXISTS manager_id, DROP COLUMN IF EXISTS title;
