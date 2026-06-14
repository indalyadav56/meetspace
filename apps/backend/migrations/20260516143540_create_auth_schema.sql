-- +goose Up
CREATE SCHEMA if not EXISTS auth;

-- +goose Down
DROP SCHEMA IF EXISTS auth;