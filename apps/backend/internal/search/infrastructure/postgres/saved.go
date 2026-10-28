// Package postgres stores saved searches.
package postgres

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Saved struct{ db *sql.DB }

func NewSaved(db *sql.DB) *Saved { return &Saved{db: db} }

func (r *Saved) List(ctx context.Context, ws, user string) ([]domain.SavedSearch, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, query, created_at FROM search.saved_searches WHERE workspace_id=$1 AND user_id=$2 ORDER BY created_at`, ws, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.SavedSearch{}
	for rows.Next() {
		var s domain.SavedSearch
		var q []byte
		if err := rows.Scan(&s.ID, &s.Name, &q, &s.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(q, &s.Query)
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Saved) Save(ctx context.Context, ws, user string, s *domain.SavedSearch) error {
	q, err := json.Marshal(s.Query)
	if err != nil {
		return err
	}
	return r.db.QueryRowContext(ctx, `INSERT INTO search.saved_searches (workspace_id, user_id, name, query) VALUES ($1,$2,$3,$4) RETURNING id, created_at`, ws, user, s.Name, q).Scan(&s.ID, &s.CreatedAt)
}

func (r *Saved) Delete(ctx context.Context, ws, user, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM search.saved_searches WHERE workspace_id=$1 AND user_id=$2 AND id=$3`, ws, user, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return apperror.NotFound("saved_search_not_found", "saved search not found")
	}
	return nil
}
