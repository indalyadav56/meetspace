-- +goose Up
-- Live co-editing: each doc's Yjs updates, compacted from time to time into one snapshot.
CREATE TABLE docs.doc_updates (
    seq BIGSERIAL PRIMARY KEY,
    doc_id UUID NOT NULL REFERENCES docs.docs (id) ON DELETE CASCADE,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_updates_doc ON docs.doc_updates (doc_id, seq);

-- +goose Down
DROP TABLE IF EXISTS docs.doc_updates;
