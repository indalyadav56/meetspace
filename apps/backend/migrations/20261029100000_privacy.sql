-- +goose Up
-- Which Privacy Policy and Terms version each person accepted, and when (DPDP consent record).
ALTER TABLE auth.users ADD COLUMN consent_version TEXT, ADD COLUMN consented_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE auth.users DROP COLUMN consent_version, DROP COLUMN consented_at;
