package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/model"
)

type PasswordResetTokenRepository interface {
	Create(ctx context.Context, t *model.PasswordResetToken) error
	GetByHash(ctx context.Context, tokenHash string) (*model.PasswordResetToken, error)
	MarkUsed(ctx context.Context, id string, usedAt time.Time) error
}

type passwordResetTokenRepository struct {
	db *sql.DB
}

func NewPasswordResetTokenRepository(db *sql.DB) PasswordResetTokenRepository {
	return &passwordResetTokenRepository{db: db}
}

func (r *passwordResetTokenRepository) Create(ctx context.Context, t *model.PasswordResetToken) error {
	const q = `
		INSERT INTO auth.password_reset_tokens (user_id, token, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`
	err := r.db.QueryRowContext(ctx, q, t.UserID, t.TokenHash, t.ExpiresAt).
		Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		return fmt.Errorf("create reset token: %w", err)
	}
	return nil
}

func (r *passwordResetTokenRepository) GetByHash(ctx context.Context, tokenHash string) (*model.PasswordResetToken, error) {
	const q = `
		SELECT id, user_id, token, expires_at, used_at, created_at
		FROM auth.password_reset_tokens
		WHERE token = $1`
	var (
		t      model.PasswordResetToken
		usedAt sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, q, tokenHash).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &usedAt, &t.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, model.ErrTokenNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get reset token: %w", err)
	}
	if usedAt.Valid {
		t.UsedAt = &usedAt.Time
	}
	return &t, nil
}

func (r *passwordResetTokenRepository) MarkUsed(ctx context.Context, id string, usedAt time.Time) error {
	const q = `UPDATE auth.password_reset_tokens SET used_at = $2 WHERE id = $1`
	if _, err := r.db.ExecContext(ctx, q, id, usedAt); err != nil {
		return fmt.Errorf("mark reset token used: %w", err)
	}
	return nil
}
