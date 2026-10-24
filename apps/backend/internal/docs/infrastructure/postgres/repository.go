// Package postgres implements the docs repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/docs/domain"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

const docCols = `id, workspace_id, project_id::text, title, content, emoji, COALESCE(created_by::text,''), updated_at`

func scanDoc(r interface{ Scan(...any) error }) (*domain.Doc, error) {
	var d domain.Doc
	var project sql.NullString
	if err := r.Scan(&d.ID, &d.WorkspaceID, &project, &d.Title, &d.Content, &d.Emoji, &d.CreatedBy, &d.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrDocNotFound
		}
		return nil, err
	}
	if project.Valid {
		d.ProjectID = &project.String
	}
	return &d, nil
}

func (r *Repository) CreateDoc(ctx context.Context, d *domain.Doc) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO docs.docs (id, workspace_id, project_id, title, content, emoji, created_by) VALUES (COALESCE(NULLIF($7, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6) RETURNING id, updated_at`,
		d.WorkspaceID, d.ProjectID, d.Title, d.Content, d.Emoji, d.CreatedBy, d.ID).Scan(&d.ID, &d.UpdatedAt)
}

func (r *Repository) GetDoc(ctx context.Context, ws, id string) (*domain.Doc, error) {
	return scanDoc(r.db.QueryRowContext(ctx, `SELECT `+docCols+` FROM docs.docs WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL`, ws, id))
}

func (r *Repository) ListDocs(ctx context.Context, ws string) ([]domain.Doc, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+docCols+` FROM docs.docs WHERE workspace_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Doc
	for rows.Next() {
		d, err := scanDoc(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateDoc(ctx context.Context, d *domain.Doc) error {
	return r.db.QueryRowContext(ctx, `UPDATE docs.docs SET project_id=$3, title=$4, content=$5, emoji=$6, updated_at=now() WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING updated_at`,
		d.WorkspaceID, d.ID, d.ProjectID, d.Title, d.Content, d.Emoji).Scan(&d.UpdatedAt)
}

func (r *Repository) DeleteDoc(ctx context.Context, ws, id, actorID string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE docs.docs SET deleted_at=now(), deleted_by=NULLIF($3, '')::uuid WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL`, ws, id, actorID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrDocNotFound
	}
	return nil
}

const wbCols = `id, workspace_id, title, items, COALESCE(created_by::text,''), created_at, updated_at`

func scanWB(r interface{ Scan(...any) error }) (*domain.Whiteboard, error) {
	var w domain.Whiteboard
	var items []byte
	if err := r.Scan(&w.ID, &w.WorkspaceID, &w.Title, &items, &w.CreatedBy, &w.CreatedAt, &w.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrWhiteboardNotFound
		}
		return nil, err
	}
	w.Items = items
	return &w, nil
}

func (r *Repository) CreateWhiteboard(ctx context.Context, w *domain.Whiteboard) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO docs.whiteboards (id, workspace_id, title, items, created_by) VALUES (COALESCE(NULLIF($5, '')::uuid, uuidv7()), $1,$2,$3,$4) RETURNING id, created_at, updated_at`,
		w.WorkspaceID, w.Title, []byte(w.Items), w.CreatedBy, w.ID).Scan(&w.ID, &w.CreatedAt, &w.UpdatedAt)
}

func (r *Repository) GetWhiteboard(ctx context.Context, ws, id string) (*domain.Whiteboard, error) {
	return scanWB(r.db.QueryRowContext(ctx, `SELECT `+wbCols+` FROM docs.whiteboards WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL`, ws, id))
}

func (r *Repository) ListWhiteboards(ctx context.Context, ws string) ([]domain.Whiteboard, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+wbCols+` FROM docs.whiteboards WHERE workspace_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Whiteboard
	for rows.Next() {
		w, err := scanWB(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *w)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateWhiteboard(ctx context.Context, w *domain.Whiteboard) error {
	return r.db.QueryRowContext(ctx, `UPDATE docs.whiteboards SET title=$3, items=$4, updated_at=now() WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING updated_at`,
		w.WorkspaceID, w.ID, w.Title, []byte(w.Items)).Scan(&w.UpdatedAt)
}

func (r *Repository) DeleteWhiteboard(ctx context.Context, ws, id, actorID string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE docs.whiteboards SET deleted_at=now(), deleted_by=NULLIF($3, '')::uuid WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL`, ws, id, actorID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrWhiteboardNotFound
	}
	return nil
}

// table maps a trash kind to its table; only these two values are ever interpolated.
func trashTable(kind string) string {
	if kind == domain.TrashWhiteboard {
		return "docs.whiteboards"
	}
	return "docs.docs"
}

// Restore brings a trashed doc or whiteboard back.
func (r *Repository) Restore(ctx context.Context, ws, kind, id string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE `+trashTable(kind)+` SET deleted_at=NULL, deleted_by=NULL, updated_at=now() WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NOT NULL`, ws, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrDocNotFound
	}
	return nil
}

// Purge deletes a trashed doc or whiteboard for good.
func (r *Repository) Purge(ctx context.Context, ws, kind, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM `+trashTable(kind)+` WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NOT NULL`, ws, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrDocNotFound
	}
	return nil
}

func (r *Repository) ListTrash(ctx context.Context, ws string) ([]domain.TrashedItem, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 'doc', id, title, emoji, deleted_at, COALESCE(deleted_by::text, '') FROM docs.docs WHERE workspace_id=$1 AND deleted_at IS NOT NULL
		UNION ALL
		SELECT 'whiteboard', id, title, '', deleted_at, COALESCE(deleted_by::text, '') FROM docs.whiteboards WHERE workspace_id=$1 AND deleted_at IS NOT NULL
		ORDER BY 5 DESC LIMIT 500`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.TrashedItem{}
	for rows.Next() {
		var x domain.TrashedItem
		if err := rows.Scan(&x.Kind, &x.ID, &x.Title, &x.Emoji, &x.DeletedAt, &x.DeletedBy); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

const dashCols = `id, project_id::text, title, cards::text, COALESCE(created_by::text, ''), created_at, updated_at`

func scanDash(r interface{ Scan(...any) error }, ws string) (*domain.Dashboard, error) {
	d := domain.Dashboard{WorkspaceID: ws}
	var cards string
	if err := r.Scan(&d.ID, &d.ProjectID, &d.Title, &cards, &d.CreatedBy, &d.CreatedAt, &d.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrDashboardNotFound
		}
		return nil, err
	}
	d.Cards = []string{}
	return &d, json.Unmarshal([]byte(cards), &d.Cards)
}

func (r *Repository) ListDashboards(ctx context.Context, ws string) ([]domain.Dashboard, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+dashCols+` FROM docs.dashboards WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Dashboard{}
	for rows.Next() {
		d, err := scanDash(rows, ws)
		if err != nil {
			return nil, err
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

func (r *Repository) GetDashboard(ctx context.Context, ws, id string) (*domain.Dashboard, error) {
	return scanDash(r.db.QueryRowContext(ctx, `SELECT `+dashCols+` FROM docs.dashboards WHERE workspace_id=$1 AND id=$2`, ws, id), ws)
}

// SaveDashboard inserts a new dashboard or updates one in this workspace.
func (r *Repository) SaveDashboard(ctx context.Context, d *domain.Dashboard) error {
	cards, _ := json.Marshal(d.Cards)
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO docs.dashboards (id, workspace_id, project_id, title, cards, created_by)
		VALUES (COALESCE(NULLIF($1, '')::uuid, uuidv7()), $2, $3::uuid, $4, $5::jsonb, NULLIF($6, '')::uuid)
		ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id, title=EXCLUDED.title, cards=EXCLUDED.cards, updated_at=now()
		WHERE docs.dashboards.workspace_id = EXCLUDED.workspace_id
		RETURNING id, created_at, updated_at`, d.ID, d.WorkspaceID, d.ProjectID, d.Title, string(cards), d.CreatedBy).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.ErrDashboardNotFound
	}
	return err
}

func (r *Repository) DeleteDashboard(ctx context.Context, ws, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM docs.dashboards WHERE workspace_id=$1 AND id=$2`, ws, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrDashboardNotFound
	}
	return nil
}
