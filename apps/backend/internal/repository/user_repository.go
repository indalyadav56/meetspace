package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/indalyadav56/meetspace/backend/internal/model"
)

const pgUniqueViolation = "23505"

type UserRepository interface {
	Create(ctx context.Context, u *model.User) error
	GetByID(ctx context.Context, id string) (*model.User, error)
	GetByEmail(ctx context.Context, email string) (*model.User, error)
	UpdateProfile(ctx context.Context, id, fullName string) (*model.User, error)
	UpdatePassword(ctx context.Context, id, passwordHash string) error
	UpdateLastLogin(ctx context.Context, id string, at time.Time) error
}

type userRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) UserRepository {
	return &userRepository{db: db}
}

const userColumns = `id, email, full_name, password_hash, is_active, is_super_admin, last_login_at, created_at, updated_at, deleted_at`

func (r *userRepository) Create(ctx context.Context, u *model.User) error {
	const q = `
		INSERT INTO auth.users (email, full_name, password_hash, is_active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, is_super_admin, created_at, updated_at`
	err := r.db.QueryRowContext(ctx, q, u.Email, u.FullName, u.PasswordHash, u.IsActive).
		Scan(&u.ID, &u.IsSuperAdmin, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return model.ErrEmailExists
		}
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	const q = `SELECT ` + userColumns + ` FROM auth.users WHERE id = $1 AND deleted_at IS NULL`
	return scanUser(r.db.QueryRowContext(ctx, q, id))
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	const q = `SELECT ` + userColumns + ` FROM auth.users WHERE email = $1 AND deleted_at IS NULL`
	return scanUser(r.db.QueryRowContext(ctx, q, email))
}

func (r *userRepository) UpdateProfile(ctx context.Context, id, fullName string) (*model.User, error) {
	const q = `
		UPDATE auth.users
		SET full_name = $2, updated_at = now() AT TIME ZONE 'utc'
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING ` + userColumns
	return scanUser(r.db.QueryRowContext(ctx, q, id, fullName))
}

func (r *userRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	const q = `
		UPDATE auth.users
		SET password_hash = $2, updated_at = now() AT TIME ZONE 'utc'
		WHERE id = $1 AND deleted_at IS NULL`
	return r.execExpectOne(ctx, q, id, passwordHash)
}

func (r *userRepository) UpdateLastLogin(ctx context.Context, id string, at time.Time) error {
	const q = `
		UPDATE auth.users
		SET last_login_at = $2, updated_at = now() AT TIME ZONE 'utc'
		WHERE id = $1 AND deleted_at IS NULL`
	return r.execExpectOne(ctx, q, id, at)
}

func (r *userRepository) execExpectOne(ctx context.Context, q string, args ...any) error {
	res, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if n == 0 {
		return model.ErrUserNotFound
	}
	return nil
}

func scanUser(row *sql.Row) (*model.User, error) {
	var (
		u           model.User
		lastLoginAt sql.NullTime
		deletedAt   sql.NullTime
	)
	err := row.Scan(
		&u.ID, &u.Email, &u.FullName, &u.PasswordHash, &u.IsActive, &u.IsSuperAdmin,
		&lastLoginAt, &u.CreatedAt, &u.UpdatedAt, &deletedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, model.ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("scan user: %w", err)
	}
	if lastLoginAt.Valid {
		u.LastLoginAt = &lastLoginAt.Time
	}
	if deletedAt.Valid {
		u.DeletedAt = &deletedAt.Time
	}
	return &u, nil
}
