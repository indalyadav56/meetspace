-- +goose Up
CREATE SCHEMA IF NOT EXISTS work;

CREATE TABLE work.projects (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    color VARCHAR(16) NOT NULL,
    -- ordered list of {id,name,color,type}
    statuses JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_ws ON work.projects (workspace_id);

CREATE TABLE work.folders (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES work.projects (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_folders_ws ON work.folders (workspace_id);

CREATE TABLE work.lists (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES work.projects (id) ON DELETE CASCADE,
    folder_id UUID REFERENCES work.folders (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lists_ws ON work.lists (workspace_id);

CREATE TABLE work.sprints (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES work.projects (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    goal TEXT NOT NULL DEFAULT '',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('planned', 'active', 'done')),
    completed_points NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sprints_ws ON work.sprints (workspace_id);

CREATE TABLE work.tasks (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    key BIGINT NOT NULL,
    list_id UUID NOT NULL REFERENCES work.lists (id) ON DELETE CASCADE,
    parent_id UUID REFERENCES work.tasks (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status_id VARCHAR(64) NOT NULL,
    priority VARCHAR(16) CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    assignees JSONB NOT NULL DEFAULT '[]',
    tags JSONB NOT NULL DEFAULT '[]',
    start_date DATE,
    due_date DATE,
    estimate NUMERIC,
    checklist JSONB NOT NULL DEFAULT '[]',
    blocked_by JSONB NOT NULL DEFAULT '[]',
    recurrence VARCHAR(16) CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
    custom JSONB NOT NULL DEFAULT '{}',
    sprint_id UUID REFERENCES work.sprints (id) ON DELETE SET NULL,
    points NUMERIC,
    watchers JSONB NOT NULL DEFAULT '[]',
    clip_ids JSONB NOT NULL DEFAULT '[]',
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, key)
);
CREATE INDEX idx_tasks_ws ON work.tasks (workspace_id);
CREATE INDEX idx_tasks_list ON work.tasks (list_id);
CREATE INDEX idx_tasks_parent ON work.tasks (parent_id);

CREATE TABLE work.comments (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES work.tasks (id) ON DELETE CASCADE,
    -- NULL author means the automation bot
    user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    assignee UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_task ON work.comments (task_id);
CREATE INDEX idx_comments_ws ON work.comments (workspace_id);

CREATE TABLE work.activity (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES work.tasks (id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_task ON work.activity (task_id);
CREATE INDEX idx_activity_ws ON work.activity (workspace_id, created_at DESC);

CREATE TABLE work.custom_fields (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES work.lists (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('text', 'number', 'dropdown', 'checkbox', 'date', 'money')),
    options JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fields_ws ON work.custom_fields (workspace_id);

CREATE TABLE work.time_entries (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES work.tasks (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    duration_min INT NOT NULL CHECK (duration_min > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_ws ON work.time_entries (workspace_id);

-- one running timer per user per workspace
CREATE TABLE work.timers (
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES work.tasks (id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE work.automations (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES work.projects (id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    trigger JSONB NOT NULL,
    actions JSONB NOT NULL,
    runs INT NOT NULL DEFAULT 0,
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_automations_ws ON work.automations (workspace_id);

CREATE TABLE work.forms (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES work.lists (id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color VARCHAR(16) NOT NULL DEFAULT '#4f46e5',
    fields JSONB NOT NULL DEFAULT '[]',
    assign_to JSONB NOT NULL DEFAULT '[]',
    submit_text VARCHAR(80) NOT NULL DEFAULT 'Submit',
    thanks_text TEXT NOT NULL DEFAULT 'Thanks — your response was recorded.',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    submissions INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_forms_ws ON work.forms (workspace_id);

-- +goose Down
DROP SCHEMA IF EXISTS work CASCADE;
