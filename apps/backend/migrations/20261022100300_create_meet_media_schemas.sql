-- +goose Up
CREATE SCHEMA IF NOT EXISTS media;

CREATE TABLE media.clips (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('screen', 'camera', 'screen+camera', 'call', 'audio')),
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    duration_sec INT NOT NULL DEFAULT 0,
    size BIGINT NOT NULL DEFAULT 0,
    mime VARCHAR(80) NOT NULL,
    task_id UUID,
    transcript TEXT NOT NULL DEFAULT '',
    thumb TEXT NOT NULL DEFAULT '',
    storage_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clips_ws ON media.clips (workspace_id, created_at DESC);

CREATE SCHEMA IF NOT EXISTS meet;

CREATE TABLE meet.meetings (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    duration_min INT NOT NULL CHECK (duration_min > 0),
    attendees JSONB NOT NULL DEFAULT '[]',
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('video', 'audio')),
    agenda TEXT NOT NULL DEFAULT '',
    channel_id UUID,
    task_id UUID,
    notes_doc_id UUID,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetings_ws ON meet.meetings (workspace_id, start_at);

CREATE TABLE meet.calls (
    id UUID PRIMARY KEY DEFAULT uuidv7 (),
    workspace_id UUID NOT NULL REFERENCES workspace.workspaces (id) ON DELETE CASCADE,
    -- LiveKit room name; shared by every participant of the call
    room VARCHAR(120) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('video', 'audio')),
    channel_id UUID,
    meeting_id UUID REFERENCES meet.meetings (id) ON DELETE SET NULL,
    started_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    participants JSONB NOT NULL DEFAULT '[]',
    -- identities currently connected, maintained from LiveKit webhooks
    live_participants JSONB NOT NULL DEFAULT '[]',
    recording_clip_id UUID,
    notes_doc_id UUID
);
CREATE INDEX idx_calls_ws ON meet.calls (workspace_id, started_at DESC);

-- +goose Down
DROP SCHEMA IF EXISTS meet CASCADE;
DROP SCHEMA IF EXISTS media CASCADE;
