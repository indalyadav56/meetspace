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
	// Title and ManagerID drive the org chart.
	Title     string  `json:"title"`
	ManagerID *string `json:"managerId"`
}

// Team is a named group of workspace members.
type Team struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	Description string    `json:"description"`
	LeadID      *string   `json:"leadId"`
	Members     []string  `json:"members"`
	CreatedBy   string    `json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

var (
	ErrNotFound    = apperror.NotFound("workspace_not_found", "workspace not found")
	ErrNotMember   = apperror.Forbidden("not_a_member", "you are not a member of this workspace")
	ErrForbidden   = apperror.Forbidden("forbidden", "your role can't do that in this workspace")
	ErrLastOwner   = apperror.Conflict("last_owner", "a workspace needs at least one owner")
	ErrInvalidRole = apperror.Invalid("invalid_role", "role must be owner, admin, member or guest")
	ErrInvalidName = apperror.Invalid("invalid_name", "workspace name must be 1-120 characters")

	ErrTeamNotFound   = apperror.NotFound("team_not_found", "team not found")
	ErrTeamName       = apperror.Invalid("invalid_team_name", "team name must be 1-80 characters")
	ErrManagerCycle   = apperror.Invalid("manager_cycle", "that would make someone their own manager")
	ErrManagerUnknown = apperror.Invalid("manager_not_member", "the manager must be a member of this workspace")
)

type Repository interface {
	Create(ctx context.Context, w *Workspace, owner string) error
	Get(ctx context.Context, id string) (*Workspace, error)
	ListForUser(ctx context.Context, userID string) ([]Workspace, error)
	// AllIDs lists every live workspace (maintenance jobs such as reindexing).
	AllIDs(ctx context.Context) ([]string, error)
	Update(ctx context.Context, w *Workspace) error
	Delete(ctx context.Context, id string) error
	Role(ctx context.Context, workspaceID, userID string) (Role, error)
	UpsertMember(ctx context.Context, workspaceID string, m Member) error
	RemoveMember(ctx context.Context, workspaceID, userID string) error
	CountOwners(ctx context.Context, workspaceID string) (int, error)
	// NextTaskKey atomically reserves the next human-readable task number.
	NextTaskKey(ctx context.Context, workspaceID string) (int64, error)

	SetMemberProfile(ctx context.Context, workspaceID, userID, title string, managerID *string) error
	ListTeams(ctx context.Context, workspaceID string) ([]Team, error)
	GetTeam(ctx context.Context, workspaceID, id string) (*Team, error)
	// SaveTeam inserts or updates a team and replaces its member list.
	SaveTeam(ctx context.Context, t *Team) error
	DeleteTeam(ctx context.Context, workspaceID, id string) error
}
