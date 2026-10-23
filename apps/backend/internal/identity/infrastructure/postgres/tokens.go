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
		`INSERT INTO auth.refresh_tokens (user_id, session_id, token, parent, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		t.UserID, t.SessionID, t.TokenHash, t.Parent, t.ExpiresAt).Scan(&t.ID)
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
