-- +goose Up
-- Saved dashboards: a title, an optional Space scope and the cards to show.
CREATE TABLE docs.dashboards (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    project_id UUID REFERENCES work.projects (id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    cards JSONB NOT NULL DEFAULT '[]',
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dashboards_ws ON docs.dashboards (workspace_id);

-- +goose Down
DROP TABLE IF EXISTS docs.dashboards;
