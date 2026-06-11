CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    initials        TEXT NOT NULL DEFAULT '',
    color           TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT '',
    presence        TEXT NOT NULL DEFAULT 'offline',
    status_message  TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    key         TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '',
    lead_id     TEXT NOT NULL DEFAULT '',
    member_ids  JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
    id           TEXT PRIMARY KEY,
    key          TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'todo',
    priority     TEXT NOT NULL DEFAULT 'none',
    type         TEXT NOT NULL DEFAULT '',
    team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    assignee_ids JSONB NOT NULL DEFAULT '[]',
    tags         JSONB NOT NULL DEFAULT '[]',
    due_date     TIMESTAMPTZ,
    subtasks     JSONB NOT NULL DEFAULT '[]',
    comments     JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_team_id_idx ON tasks (team_id);
CREATE INDEX tasks_status_idx ON tasks (status);
CREATE INDEX tasks_assignees_idx ON tasks USING GIN (assignee_ids);

CREATE TABLE task_counters (
    team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    n       INT NOT NULL DEFAULT 0
);

CREATE TABLE channels (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    private     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, name)
);

CREATE TABLE messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    author_id       TEXT NOT NULL,
    body            TEXT NOT NULL,
    parent_id       TEXT REFERENCES messages(id) ON DELETE CASCADE,
    edited          BOOLEAN NOT NULL DEFAULT FALSE,
    system          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

CREATE TABLE meetings (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    organizer_id TEXT NOT NULL,
    attendee_ids JSONB NOT NULL DEFAULT '[]',
    channel_id   TEXT,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meetings_span_idx ON meetings (starts_at, ends_at);
