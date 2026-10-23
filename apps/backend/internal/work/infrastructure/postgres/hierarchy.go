// Package postgres implements the work repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/pgjson"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

type row interface{ Scan(...any) error }

func ptr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	s := ns.String
	return &s
}

func fptr(nf sql.NullFloat64) *float64 {
	if !nf.Valid {
		return nil
	}
	f := nf.Float64
	return &f
}

func notFound(err, target error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return target
	}
	return err
}

func execOne(ctx context.Context, db *sql.DB, target error, q string, args ...any) error {
	res, err := db.ExecContext(ctx, q, args...)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return target
	}
	return nil
}

// ---- projects

func scanProject(r row) (*domain.Project, error) {
	var p domain.Project
	if err := r.Scan(&p.ID, &p.WorkspaceID, &p.Name, &p.Color, pgjson.Scan(&p.Statuses), &p.CreatedAt); err != nil {
		return nil, notFound(err, domain.ErrProjectNotFound)
	}
	return &p, nil
}

const projectCols = `id, workspace_id, name, color, statuses, created_at`

func (r *Repository) CreateProject(ctx context.Context, p *domain.Project) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.projects (id, workspace_id, name, color, statuses) VALUES (COALESCE(NULLIF($5, '')::uuid, uuidv7()), $1,$2,$3,$4) RETURNING id, created_at`,
		p.WorkspaceID, p.Name, p.Color, pgjson.Value(p.Statuses), p.ID).Scan(&p.ID, &p.CreatedAt)
}

func (r *Repository) GetProject(ctx context.Context, ws, id string) (*domain.Project, error) {
	return scanProject(r.db.QueryRowContext(ctx, `SELECT `+projectCols+` FROM work.projects WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) ListProjects(ctx context.Context, ws string) ([]domain.Project, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+projectCols+` FROM work.projects WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateProject(ctx context.Context, p *domain.Project) error {
	return execOne(ctx, r.db, domain.ErrProjectNotFound, `UPDATE work.projects SET name=$3, color=$4, statuses=$5 WHERE workspace_id=$1 AND id=$2`,
		p.WorkspaceID, p.ID, p.Name, p.Color, pgjson.Value(p.Statuses))
}

func (r *Repository) DeleteProject(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrProjectNotFound, `DELETE FROM work.projects WHERE workspace_id=$1 AND id=$2`, ws, id)
}

// ---- folders

func (r *Repository) CreateFolder(ctx context.Context, f *domain.Folder) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.folders (id, workspace_id, project_id, name) VALUES (COALESCE(NULLIF($4, '')::uuid, uuidv7()), $1,$2,$3) RETURNING id`, f.WorkspaceID, f.ProjectID, f.Name, f.ID).Scan(&f.ID)
}

func (r *Repository) GetFolder(ctx context.Context, ws, id string) (*domain.Folder, error) {
	var f domain.Folder
	err := r.db.QueryRowContext(ctx, `SELECT id, workspace_id, project_id, name FROM work.folders WHERE workspace_id=$1 AND id=$2`, ws, id).Scan(&f.ID, &f.WorkspaceID, &f.ProjectID, &f.Name)
	if err != nil {
		return nil, notFound(err, domain.ErrFolderNotFound)
	}
	return &f, nil
}

func (r *Repository) ListFolders(ctx context.Context, ws string) ([]domain.Folder, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, workspace_id, project_id, name FROM work.folders WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Folder
	for rows.Next() {
		var f domain.Folder
		if err := rows.Scan(&f.ID, &f.WorkspaceID, &f.ProjectID, &f.Name); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateFolder(ctx context.Context, f *domain.Folder) error {
	return execOne(ctx, r.db, domain.ErrFolderNotFound, `UPDATE work.folders SET name=$3 WHERE workspace_id=$1 AND id=$2`, f.WorkspaceID, f.ID, f.Name)
}

func (r *Repository) DeleteFolder(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrFolderNotFound, `DELETE FROM work.folders WHERE workspace_id=$1 AND id=$2`, ws, id)
}

// ---- lists

func (r *Repository) CreateList(ctx context.Context, l *domain.List) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO work.lists (id, workspace_id, project_id, folder_id, name) VALUES (COALESCE(NULLIF($5, '')::uuid, uuidv7()), $1,$2,$3,$4) RETURNING id`, l.WorkspaceID, l.ProjectID, l.FolderID, l.Name, l.ID).Scan(&l.ID)
}

func scanList(r row) (*domain.List, error) {
	var l domain.List
	var folder sql.NullString
	if err := r.Scan(&l.ID, &l.WorkspaceID, &l.ProjectID, &folder, &l.Name); err != nil {
		return nil, notFound(err, domain.ErrListNotFound)
	}
	l.FolderID = ptr(folder)
	return &l, nil
}

func (r *Repository) GetList(ctx context.Context, ws, id string) (*domain.List, error) {
	return scanList(r.db.QueryRowContext(ctx, `SELECT id, workspace_id, project_id, folder_id::text, name FROM work.lists WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) ListLists(ctx context.Context, ws string) ([]domain.List, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, workspace_id, project_id, folder_id::text, name FROM work.lists WHERE workspace_id=$1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.List
	for rows.Next() {
		l, err := scanList(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *l)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateList(ctx context.Context, l *domain.List) error {
	return execOne(ctx, r.db, domain.ErrListNotFound, `UPDATE work.lists SET name=$3, folder_id=$4 WHERE workspace_id=$1 AND id=$2`, l.WorkspaceID, l.ID, l.Name, l.FolderID)
}

func (r *Repository) DeleteList(ctx context.Context, ws, id string) error {
	return execOne(ctx, r.db, domain.ErrListNotFound, `DELETE FROM work.lists WHERE workspace_id=$1 AND id=$2`, ws, id)
}
