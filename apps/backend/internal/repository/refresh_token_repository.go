package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/indalyadav56/meetspace/backend/internal/model"
)

type RefreshTokenRepository interface {
	Create(ctx context.Context, t *model.RefreshToken) error
	GetByHash(ctx context.Context, tokenHash string) (*model.RefreshToken, error)
	Revoke(ctx context.Context, id string) error
	RevokeSession(ctx context.Context, sessionID string) error
	RevokeAllForUser(ctx context.Context, userID string) error
}

type refreshTokenRepository struct {
	db *sql.DB
}

func NewRefreshTokenRepository(db *sql.DB) RefreshTokenRepository {
	return &refreshTokenRepository{db: db}
}

func (r *refreshTokenRepository) Create(ctx context.Context, t *model.RefreshToken) error {
	const q = `
		INSERT INTO auth.refresh_tokens (user_id, session_id, token, parent, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, revoked, created_at, updated_at`
	err := r.db.QueryRowContext(ctx, q, t.UserID, t.SessionID, t.TokenHash, t.Parent, t.ExpiresAt).
		Scan(&t.ID, &t.Revoked, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create refresh token: %w", err)
	}
	return nil
}

func (r *refreshTokenRepository) GetByHash(ctx context.Context, tokenHash string) (*model.RefreshToken, error) {
	const q = `
		SELECT id, user_id, session_id, token, revoked, parent, expires_at, created_at, updated_at
		FROM auth.refresh_tokens
		WHERE token = $1`
	var (
		t      model.RefreshToken
		parent sql.NullString
	)
	err := r.db.QueryRowContext(ctx, q, tokenHash).Scan(
		&t.ID, &t.UserID, &t.SessionID, &t.TokenHash, &t.Revoked, &parent,
		&t.ExpiresAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, model.ErrTokenNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get refresh token: %w", err)
	}
	if parent.Valid {
		t.Parent = &parent.String
	}
	return &t, nil
}

func (r *refreshTokenRepository) Revoke(ctx context.Context, id string) error {
	const q = `UPDATE auth.refresh_tokens SET revoked = true, updated_at = now() AT TIME ZONE 'utc' WHERE id = $1`
	if _, err := r.db.ExecContext(ctx, q, id); err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}

func (r *refreshTokenRepository) RevokeSession(ctx context.Context, sessionID string) error {
	const q = `UPDATE auth.refresh_tokens SET revoked = true, updated_at = now() AT TIME ZONE 'utc' WHERE session_id = $1 AND revoked = false`
	if _, err := r.db.ExecContext(ctx, q, sessionID); err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}

func (r *refreshTokenRepository) RevokeAllForUser(ctx context.Context, userID string) error {
	const q = `UPDATE auth.refresh_tokens SET revoked = true, updated_at = now() AT TIME ZONE 'utc' WHERE user_id = $1 AND revoked = false`
	if _, err := r.db.ExecContext(ctx, q, userID); err != nil {
		return fmt.Errorf("revoke user tokens: %w", err)
	}
	return nil
}
