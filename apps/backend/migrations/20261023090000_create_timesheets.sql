-- +goose Up
-- One row per person per week once they act on it (submit, approve, reject).
CREATE TABLE work.timesheets (
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    week_start DATE NOT NULL, -- Monday
    status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved', 'rejected')),
    note TEXT NOT NULL DEFAULT '',
    submitted_at TIMESTAMPTZ,
    decided_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id, week_start)
);
CREATE INDEX idx_timesheets_status ON work.timesheets (workspace_id, status);

-- +goose Down
DROP TABLE IF EXISTS work.timesheets;
