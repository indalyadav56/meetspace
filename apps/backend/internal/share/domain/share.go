// Package domain defines public share links: read-only "anyone with the link" access.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Link struct {
	ID           string     `json:"id"`
	WorkspaceID  string     `json:"-"`
	Kind         string     `json:"kind"`
	EntityID     string     `json:"entityId"`
	Token        string     `json:"token"`
	CreatedBy    *string    `json:"createdBy"`
	ExpiresAt    *time.Time `json:"expiresAt"`
	Views        int        `json:"views"`
	LastViewedAt *time.Time `json:"lastViewedAt"`
	CreatedAt    time.Time  `json:"createdAt"`
}

var Kinds = map[string]bool{"doc": true, "list": true, "whiteboard": true}

type Repository interface {
	Create(ctx context.Context, l *Link) error
	Active(ctx context.Context, ws, kind, entityID string) (*Link, error)
	ByToken(ctx context.Context, token string) (*Link, error)
	SetExpiry(ctx context.Context, ws, id string, expires *time.Time) error
	Revoke(ctx context.Context, ws, id string) error
	CountView(ctx context.Context, id string) error
	ForWorkspace(ctx context.Context, ws string) ([]Link, error)
}

var (
	ErrNotFound    = apperror.NotFound("share_not_found", "this link doesn’t exist or was turned off")
	ErrExpired     = apperror.NotFound("share_expired", "this link has expired")
	ErrInvalidKind = apperror.Invalid("invalid_kind", "you can share a doc, a list or a whiteboard")
)
