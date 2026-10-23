// Package domain holds the assistant's saved agents: named personas with
// standing instructions that shape how the assistant answers.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Agent struct {
	ID           string    `json:"id"`
	WorkspaceID  string    `json:"-"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	Instructions string    `json:"instructions"`
	Icon         string    `json:"icon"`
	CreatedBy    *string   `json:"createdBy"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

var (
	ErrAgentNotFound = apperror.NotFound("agent_not_found", "agent not found")
	ErrInvalidAgent  = apperror.Invalid("invalid_agent", "an agent needs a name (up to 80 characters) and instructions up to 4000 characters")
)

type AgentRepository interface {
	List(ctx context.Context, ws string) ([]Agent, error)
	Get(ctx context.Context, ws, id string) (*Agent, error)
	Create(ctx context.Context, a *Agent) error
	Update(ctx context.Context, a *Agent) error
	Delete(ctx context.Context, ws, id string) error
}
