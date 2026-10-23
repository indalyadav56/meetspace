// Package domain holds the workspace context's entities and repository ports.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
	RoleGuest  Role = "guest"
)

func (r Role) Valid() bool {
	return r == RoleOwner || r == RoleAdmin || r == RoleMember || r == RoleGuest
}

// CanManage reports whether the role may change workspace settings and members.
func (r Role) CanManage() bool { return r == RoleOwner || r == RoleAdmin }

type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedBy string    `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
	Members   []Member  `json:"members"`
}

type Member struct {
	UserID  string `json:"userId"`
	Role    Role   `json:"role"`
	Invited bool   `json:"invited,omitempty"`
}

var (
	ErrNotFound    = apperror.NotFound("workspace_not_found", "workspace not found")
	ErrNotMember   = apperror.Forbidden("not_a_member", "you are not a member of this workspace")
	ErrForbidden   = apperror.Forbidden("forbidden", "your role can't do that in this workspace")
	ErrLastOwner   = apperror.Conflict("last_owner", "a workspace needs at least one owner")
	ErrInvalidRole = apperror.Invalid("invalid_role", "role must be owner, admin, member or guest")
	ErrInvalidName = apperror.Invalid("invalid_name", "workspace name must be 1-120 characters")
)

type Repository interface {
	Create(ctx context.Context, w *Workspace, owner string) error
	Get(ctx context.Context, id string) (*Workspace, error)
	ListForUser(ctx context.Context, userID string) ([]Workspace, error)
	Update(ctx context.Context, w *Workspace) error
	Delete(ctx context.Context, id string) error
	Role(ctx context.Context, workspaceID, userID string) (Role, error)
	UpsertMember(ctx context.Context, workspaceID string, m Member) error
	RemoveMember(ctx context.Context, workspaceID, userID string) error
	CountOwners(ctx context.Context, workspaceID string) (int, error)
	// NextTaskKey atomically reserves the next human-readable task number.
	NextTaskKey(ctx context.Context, workspaceID string) (int64, error)
}
