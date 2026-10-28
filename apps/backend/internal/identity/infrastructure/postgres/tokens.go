package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
)

type RefreshTokenRepository struct{ db *sql.DB }

func NewRefreshTokenRepository(db *sql.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(ctx context.Context, t *domain.RefreshToken) error {
	return r.db.QueryRowContext(ctx,
		`INSERT INTO auth.refresh_tokens (user_id, session_id, token, parent, expires_at, user_agent, ip) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		t.UserID, t.SessionID, t.TokenHash, t.Parent, t.ExpiresAt, t.UserAgent, t.IP).Scan(&t.ID)
}

func (r *RefreshTokenRepository) GetByHash(ctx context.Context, hash string) (*domain.RefreshToken, error) {
	var t domain.RefreshToken
	var parent sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, session_id, token, revoked, parent, expires_at FROM auth.refresh_tokens WHERE token=$1`, hash).
		Scan(&t.ID, &t.UserID, &t.SessionID, &t.TokenHash, &t.Revoked, &parent, &t.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrTokenNotFound
	}
	if err != nil {
		return nil, err
	}
	if parent.Valid {
		t.Parent = &parent.String
	}
	return &t, nil
}

func (r *RefreshTokenRepository) Revoke(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.refresh_tokens SET revoked=true, updated_at=now() WHERE id=$1`, id)
	return err
}

func (r *RefreshTokenRepository) RevokeSession(ctx context.Context, sessionID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.refresh_tokens SET revoked=true, updated_at=now() WHERE session_id=$1 AND NOT revoked`, sessionID)
	return err
}

func (r *RefreshTokenRepository) RevokeAllForUser(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.refresh_tokens SET revoked=true, updated_at=now() WHERE user_id=$1 AND NOT revoked`, userID)
	return err
}

// Sessions lists the user's live sessions, newest activity first.
func (r *RefreshTokenRepository) Sessions(ctx context.Context, userID string) ([]domain.Session, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT session_id::text,
		       (array_agg(user_agent ORDER BY created_at DESC))[1],
		       (array_agg(ip ORDER BY created_at DESC))[1],
		       min(created_at), max(created_at)
		FROM auth.refresh_tokens
		WHERE user_id = $1
		GROUP BY session_id
		HAVING bool_or(NOT revoked AND expires_at > now())
		ORDER BY max(created_at) DESC
		LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Session{}
	for rows.Next() {
		var s domain.Session
		if err := rows.Scan(&s.ID, &s.UserAgent, &s.IP, &s.StartedAt, &s.LastSeen); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *RefreshTokenRepository) RevokeUserSession(ctx context.Context, userID, sessionID string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.refresh_tokens SET revoked=true, updated_at=now() WHERE user_id=$1 AND session_id::text=$2 AND NOT revoked`, userID, sessionID)
	return err
}

// IdentityRepository stores single sign-on links.
type IdentityRepository struct{ db *sql.DB }

func NewIdentityRepository(db *sql.DB) *IdentityRepository { return &IdentityRepository{db: db} }

func (r *IdentityRepository) FindUser(ctx context.Context, provider, subject string) (string, error) {
	var id string
	err := r.db.QueryRowContext(ctx, `SELECT user_id::text FROM auth.identities WHERE provider=$1 AND subject=$2`, provider, subject).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrUserNotFound
	}
	return id, err
}

func (r *IdentityRepository) Link(ctx context.Context, userID, provider, subject, email string) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO auth.identities (user_id, provider, subject, email) VALUES ($1,$2,$3,$4) ON CONFLICT (provider, subject) DO UPDATE SET email=EXCLUDED.email`, userID, provider, subject, email)
	return err
}

func (r *IdentityRepository) ForUser(ctx context.Context, userID string) ([]domain.Identity, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT provider, email, created_at FROM auth.identities WHERE user_id=$1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Identity{}
	for rows.Next() {
		var i domain.Identity
		if err := rows.Scan(&i.Provider, &i.Email, &i.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

type PasswordResetTokenRepository struct{ db *sql.DB }

func NewPasswordResetTokenRepository(db *sql.DB) *PasswordResetTokenRepository {
	return &PasswordResetTokenRepository{db: db}
}

func (r *PasswordResetTokenRepository) Create(ctx context.Context, t *domain.PasswordResetToken) error {
	return r.db.QueryRowContext(ctx,
		`INSERT INTO auth.password_reset_tokens (user_id, token, expires_at) VALUES ($1,$2,$3) RETURNING id`,
		t.UserID, t.TokenHash, t.ExpiresAt).Scan(&t.ID)
}

func (r *PasswordResetTokenRepository) GetByHash(ctx context.Context, hash string) (*domain.PasswordResetToken, error) {
	var t domain.PasswordResetToken
	var used sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, token, expires_at, used_at FROM auth.password_reset_tokens WHERE token=$1`, hash).
		Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &used)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrTokenNotFound
	}
	if err != nil {
		return nil, err
	}
	if used.Valid {
		t.UsedAt = &used.Time
	}
	return &t, nil
}

func (r *PasswordResetTokenRepository) MarkUsed(ctx context.Context, id string, at time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE auth.password_reset_tokens SET used_at=$2 WHERE id=$1`, id, at)
	return err
}
