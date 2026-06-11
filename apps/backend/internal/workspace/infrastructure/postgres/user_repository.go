package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

const userCols = `id, name, email, initials, color, role, presence, status_message, created_at`

func (r *UserRepository) List(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+userCols+` FROM users ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *u)
	}
	return users, rows.Err()
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+userCols+` FROM users WHERE id = $1`, id)
	u, err := scanUser(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrUserNotFound
	}
	return u, err
}

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO users (id, name, email, initials, color, role, presence, status_message, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		u.ID, u.Name, u.Email, u.Initials, u.Color, u.Role, u.Presence, u.StatusMessage, u.CreatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return domain.ErrEmailTaken
	}
	return err
}

type rowScanner interface{ Scan(dest ...any) error }

func scanUser(row rowScanner) (*domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.Initials, &u.Color, &u.Role,
		&u.Presence, &u.StatusMessage, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
