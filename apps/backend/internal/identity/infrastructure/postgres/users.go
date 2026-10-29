// Package postgres implements identity repositories on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
)

type UserRepository struct{ db *sql.DB }

func NewUserRepository(db *sql.DB) *UserRepository { return &UserRepository{db: db} }

const userCols = `id, email, full_name, color, status_emoji, status_text, status_until, totp_secret, totp_enabled, totp_recovery, password_hash, is_active, consent_version, consented_at, last_login_at, created_at, updated_at`

func scanUser(row interface{ Scan(...any) error }) (*domain.User, error) {
	var u domain.User
	var last, until, consented sql.NullTime
	var consent sql.NullString
	var recovery []byte
	if err := row.Scan(&u.ID, &u.Email, &u.FullName, &u.Color, &u.StatusEmoji, &u.StatusText, &until, &u.TOTPSecret, &u.TOTPEnabled, &recovery, &u.PasswordHash, &u.IsActive, &consent, &consented, &last, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrUserNotFound
		}
		return nil, err
	}
	if last.Valid {
		u.LastLoginAt = &last.Time
	}
	if until.Valid {
		u.StatusUntil = &until.Time
	}
	if consented.Valid {
		u.ConsentedAt = &consented.Time
	}
	u.ConsentVersion = consent.String
	_ = json.Unmarshal(recovery, &u.TOTPRecovery)
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

func (r *UserRepository) UpdateStatus(ctx context.Context, id, emoji, text string, until *time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.users SET status_emoji=$2, status_text=$3, status_until=$4, updated_at=now() WHERE id=$1`, id, emoji, text, until)
	return err
}

func (r *UserRepository) SetTOTP(ctx context.Context, id string, sealed []byte, enabled bool, recovery []string) error {
	if recovery == nil {
		recovery = []string{}
	}
	codes, _ := json.Marshal(recovery)
	_, err := r.db.ExecContext(ctx, `UPDATE auth.users SET totp_secret=$2, totp_enabled=$3, totp_recovery=$4, updated_at=now() WHERE id=$1`, id, sealed, enabled, codes)
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

func (r *UserRepository) SetConsent(ctx context.Context, id, version string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.users SET consent_version=$2, consented_at=$3, updated_at=now() WHERE id=$1`, id, version, at)
	return err
}

// Erase anonymises the account rather than deleting the row, so tasks and
// messages the person wrote in shared workspaces keep working; nothing left on
// it identifies them. The email is freed so they could sign up again.
func (r *UserRepository) Erase(ctx context.Context, id string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck
	for _, q := range []string{
		`UPDATE auth.users SET email = 'deleted-' || id || '@deleted.invalid', full_name = 'Deleted user', color = '#a8a29e',
			password_hash = '!deleted', status_emoji = '', status_text = '', status_until = NULL,
			totp_secret = NULL, totp_enabled = FALSE, totp_recovery = '[]', is_active = FALSE,
			last_login_at = NULL, deleted_at = now(), updated_at = now() WHERE id = $1`,
		`DELETE FROM auth.refresh_tokens WHERE user_id = $1`,
		`DELETE FROM auth.password_reset_tokens WHERE user_id = $1`,
		`DELETE FROM auth.identities WHERE user_id = $1`,
	} {
		if _, err := tx.ExecContext(ctx, q, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func itoa(i int) string {
	const digits = "0123456789"
	if i < 10 {
		return digits[i : i+1]
	}
	return itoa(i/10) + digits[i%10:i%10+1]
}
