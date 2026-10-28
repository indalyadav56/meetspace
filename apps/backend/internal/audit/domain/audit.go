// Package domain defines the audit context: an append-only record of who did what.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// Event is one audited action.
type Event struct {
	ID string `json:"id"`
	// WorkspaceID is nil for account-level events such as signing in.
	WorkspaceID *string `json:"workspaceId"`
	ActorID     *string `json:"actorId"`
	// Action is a dotted verb such as "task.created" or "auth.login_failed".
	Action string `json:"action"`
	// Route is the HTTP method and route template the action came from.
	Route      string         `json:"route,omitempty"`
	EntityType string         `json:"entityType,omitempty"`
	EntityID   string         `json:"entityId,omitempty"`
	Summary    string         `json:"summary,omitempty"`
	Meta       map[string]any `json:"meta,omitempty"`
	IP         string         `json:"ip,omitempty"`
	UserAgent  string         `json:"userAgent,omitempty"`
	Status     int            `json:"status,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
}

// Filter narrows a listing. Before is a cursor: the id of the last event already shown.
type Filter struct {
	WorkspaceID string
	// ActorID limits to one person; for account-level listings it is required.
	ActorID    string
	Action     string // exact action or a prefix ending in "." such as "task."
	EntityType string
	EntityID   string
	Query      string
	From, To   *time.Time
	Before     string
	Limit      int
	// Security includes account-level events (sign-ins, 2FA) of the workspace's members.
	Security bool
}

type Repository interface {
	Insert(ctx context.Context, e *Event) error
	List(ctx context.Context, f Filter) ([]Event, error)
	// Actions lists the distinct actions seen in a workspace, for the filter menu.
	Actions(ctx context.Context, workspaceID string) ([]string, error)
	Purge(ctx context.Context, before time.Time) (int64, error)
}

var ErrForbidden = apperror.Forbidden("audit_forbidden", "only workspace owners and admins can view the audit log")
