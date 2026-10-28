package postgres

import (
	"context"

	"github.com/indalyadav56/meetspace/backend/internal/docs/domain"
)

// AppendUpdate stores one Yjs update and returns its sequence number.
func (r *Repository) AppendUpdate(ctx context.Context, docID string, data []byte) (int64, error) {
	var seq int64
	err := r.db.QueryRowContext(ctx, `INSERT INTO docs.doc_updates (doc_id, data) VALUES ($1,$2) RETURNING seq`, docID, data).Scan(&seq)
	return seq, err
}

func (r *Repository) Updates(ctx context.Context, docID string) ([]domain.Update, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT seq, data FROM docs.doc_updates WHERE doc_id=$1 ORDER BY seq`, docID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Update
	for rows.Next() {
		var u domain.Update
		if err := rows.Scan(&u.Seq, &u.Data); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// Compact replaces every update up to upTo with one snapshot that contains them.
// Updates after upTo stay, so nothing typed during compaction is lost.
func (r *Repository) Compact(ctx context.Context, docID string, upTo int64, snapshot []byte) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM docs.doc_updates WHERE doc_id=$1 AND seq <= $2`, docID, upTo); err != nil {
		return err
	}
	// The snapshot keeps the position of the last update it covers.
	if _, err := tx.ExecContext(ctx, `INSERT INTO docs.doc_updates (seq, doc_id, data) VALUES ($1,$2,$3)`, upTo, docID, snapshot); err != nil {
		return err
	}
	return tx.Commit()
}
