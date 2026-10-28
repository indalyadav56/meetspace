-- +goose Up
-- Private Spaces: only their members (and workspace owners/admins) can see them.
-- Guests only ever see Spaces they're members of.
ALTER TABLE work.projects ADD COLUMN private BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE work.project_members (
    project_id UUID NOT NULL REFERENCES work.projects (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_members_user ON work.project_members (user_id);

-- +goose Down
DROP TABLE IF EXISTS work.project_members;
ALTER TABLE work.projects DROP COLUMN IF EXISTS private;
