// Package postgres implements identity repositories on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
)

type UserRepository struct{ db *sql.DB }

func NewUserRepository(db *sql.DB) *UserRepository { return &UserRepository{db: db} }

const userCols = `id, email, full_name, color, password_hash, is_active, last_login_at, created_at, updated_at`

func scanUser(row interface{ Scan(...any) error }) (*domain.User, error) {
	var u domain.User
	var last sql.NullTime
	if err := row.Scan(&u.ID, &u.Email, &u.FullName, &u.Color, &u.PasswordHash, &u.IsActive, &last, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	if last.Valid {
		u.LastLoginAt = &last.Time
	}
	return &u, nil
}

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO auth.users (email, full_name, color, password_hash, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at, updated_at`,
		u.Email, u.FullName, u.Color, u.PasswordHash, u.IsActive).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return domain.ErrEmailExists
	}
	return err
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	return scanUser(r.db.QueryRowContext(ctx, `SELECT `+userCols+` FROM auth.users WHERE id = $1 AND deleted_at IS NULL`, id))
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	return scanUser(r.db.QueryRowContext(ctx, `SELECT `+userCols+` FROM auth.users WHERE email = $1 AND deleted_at IS NULL`, email))
}

func (r *UserRepository) ListByIDs(ctx context.Context, ids []string) ([]domain.User, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	// ids are uuids from our own database; build a parameter list rather than relying on array encoding.
	ph := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		ph[i] = "$" + itoa(i+1)
		args[i] = id
	}
	rows, err := r.db.QueryContext(ctx, `SELECT `+userCols+` FROM auth.users WHERE deleted_at IS NULL AND id IN (`+strings.Join(ph, ",")+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

func (r *UserRepository) UpdateProfile(ctx context.Context, id, fullName, color string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.users SET full_name=$2, color=$3, updated_at=now() WHERE id=$1`, id, fullName, color)
	return err
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id, hash string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.users SET password_hash=$2, updated_at=now() WHERE id=$1`, id, hash)
	return err
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, id string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.users SET last_login_at=$2 WHERE id=$1`, id, at)
	return err
}

func itoa(i int) string {
	const digits = "0123456789"
	if i < 10 {
		return digits[i : i+1]
	}
	return itoa(i/10) + digits[i%10:i%10+1]
}
