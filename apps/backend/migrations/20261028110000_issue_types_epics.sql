-- +goose Up
-- Jira-style issue types, and epics that group tasks across Lists and Spaces.
ALTER TABLE work.tasks
    ADD COLUMN issue_type VARCHAR(12) NOT NULL DEFAULT 'task' CHECK (issue_type IN ('task', 'story', 'bug', 'epic')),
    ADD COLUMN epic_id UUID REFERENCES work.tasks (id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_epic ON work.tasks (epic_id) WHERE epic_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS work.idx_tasks_epic;
ALTER TABLE work.tasks DROP COLUMN IF EXISTS epic_id, DROP COLUMN IF EXISTS issue_type;
