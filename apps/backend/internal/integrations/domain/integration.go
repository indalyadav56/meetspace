// Package domain holds the integrations context: third-party accounts a
// workspace connects (GitHub) and the external items linked to its tasks.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

const GitHub = "github"

// Connection is one provider account connected to a workspace.
type Connection struct {
	WorkspaceID     string     `json:"-"`
	Provider        string     `json:"provider"`
	AccountLogin    string     `json:"account"`
	AccountAvatar   string     `json:"avatar"`
	TokenCiphertext []byte     `json:"-"`
	Repos           []string   `json:"repos"` // "owner/name" watched for task references
	WebhookSecret   string     `json:"-"`
	CreatedBy       *string    `json:"createdBy"`
	CreatedAt       time.Time  `json:"createdAt"`
	LastSyncedAt    *time.Time `json:"lastSyncedAt"`
}

// Link ties a pull request, issue or commit to a task.
type Link struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	TaskID      string    `json:"taskId"`
	Provider    string    `json:"provider"`
	Kind        string    `json:"kind"` // pull_request | issue | commit
	Repo        string    `json:"repo"`
	Number      int       `json:"number"`
	Ref         string    `json:"ref"` // short commit sha
	Title       string    `json:"title"`
	URL         string    `json:"url"`
	State       string    `json:"state"` // open | closed | merged
	Author      string    `json:"author"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

var (
	ErrNotConnected = apperror.Invalid("not_connected", "connect GitHub for this workspace first")
	ErrBadToken     = apperror.Invalid("invalid_token", "GitHub rejected that token; check it and its permissions")
	ErrBadURL       = apperror.Invalid("invalid_url", "paste a GitHub pull request or issue URL")
	ErrLinkNotFound = apperror.NotFound("link_not_found", "link not found")
	ErrForbidden    = apperror.Forbidden("forbidden", "only workspace admins can manage integrations")
)

type Repository interface {
	GetConnection(ctx context.Context, ws, provider string) (*Connection, error) // nil, nil when absent
	SaveConnection(ctx context.Context, c *Connection) error
	DeleteConnection(ctx context.Context, ws, provider string) error
	ListConnections(ctx context.Context, provider string) ([]Connection, error)
	MarkSynced(ctx context.Context, ws, provider string, at time.Time) error

	// UpsertLink inserts or updates by (task, url); created reports a new row.
	UpsertLink(ctx context.Context, l *Link) (created bool, prevState string, err error)
	ListLinks(ctx context.Context, ws, taskID string) ([]Link, error)
	GetLink(ctx context.Context, ws, id string) (*Link, error)
	DeleteLink(ctx context.Context, ws, id string) error
}
