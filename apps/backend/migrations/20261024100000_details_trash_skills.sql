-- +goose Up
-- Description, owner, priority and dates for Spaces (projects) and Lists.
ALTER TABLE work.projects
    ADD COLUMN description TEXT NOT NULL DEFAULT '',
    ADD COLUMN owner_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN priority VARCHAR(10),
    ADD COLUMN start_date DATE,
    ADD COLUMN due_date DATE;
ALTER TABLE work.lists
    ADD COLUMN description TEXT NOT NULL DEFAULT '',
    ADD COLUMN owner_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN priority VARCHAR(10),
    ADD COLUMN start_date DATE,
    ADD COLUMN due_date DATE;

-- Trash: deleted tasks, docs and whiteboards stay restorable until purged.
ALTER TABLE work.tasks ADD COLUMN deleted_at TIMESTAMPTZ, ADD COLUMN deleted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE docs.docs ADD COLUMN deleted_at TIMESTAMPTZ, ADD COLUMN deleted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE docs.whiteboards ADD COLUMN deleted_at TIMESTAMPTZ, ADD COLUMN deleted_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_trash ON work.tasks (workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_docs_trash ON docs.docs (workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_whiteboards_trash ON docs.whiteboards (workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Skills are reusable prompts stored next to agents.
ALTER TABLE assistant.agents
    ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'agent' CHECK (kind IN ('agent', 'skill')),
    ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;

-- +goose Down
ALTER TABLE assistant.agents DROP COLUMN IF EXISTS enabled, DROP COLUMN IF EXISTS kind;
DROP INDEX IF EXISTS docs.idx_whiteboards_trash;
DROP INDEX IF EXISTS docs.idx_docs_trash;
DROP INDEX IF EXISTS work.idx_tasks_trash;
ALTER TABLE docs.whiteboards DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE docs.docs DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE work.tasks DROP COLUMN IF EXISTS deleted_by, DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE work.lists DROP COLUMN IF EXISTS due_date, DROP COLUMN IF EXISTS start_date, DROP COLUMN IF EXISTS priority, DROP COLUMN IF EXISTS owner_id, DROP COLUMN IF EXISTS description;
ALTER TABLE work.projects DROP COLUMN IF EXISTS due_date, DROP COLUMN IF EXISTS start_date, DROP COLUMN IF EXISTS priority, DROP COLUMN IF EXISTS owner_id, DROP COLUMN IF EXISTS description;
