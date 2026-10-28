-- +goose Up
-- Agents can run on a schedule and post what they find to a channel.
ALTER TABLE assistant.agents
    ADD COLUMN schedule VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (schedule IN ('none', 'daily', 'weekdays', 'weekly')),
    ADD COLUMN schedule_time VARCHAR(5) NOT NULL DEFAULT '09:00',
    ADD COLUMN schedule_day SMALLINT NOT NULL DEFAULT 1 CHECK (schedule_day BETWEEN 0 AND 6),
    ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    ADD COLUMN schedule_prompt TEXT NOT NULL DEFAULT '',
    ADD COLUMN channel_id UUID,
    ADD COLUMN next_run_at TIMESTAMPTZ,
    ADD COLUMN last_run_at TIMESTAMPTZ,
    ADD COLUMN last_result TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_agents_due ON assistant.agents (next_run_at) WHERE next_run_at IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS assistant.idx_agents_due;
ALTER TABLE assistant.agents DROP COLUMN IF EXISTS last_result, DROP COLUMN IF EXISTS last_run_at, DROP COLUMN IF EXISTS next_run_at,
    DROP COLUMN IF EXISTS channel_id, DROP COLUMN IF EXISTS schedule_prompt, DROP COLUMN IF EXISTS timezone,
    DROP COLUMN IF EXISTS schedule_day, DROP COLUMN IF EXISTS schedule_time, DROP COLUMN IF EXISTS schedule;
