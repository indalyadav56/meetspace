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
	// Kind is "agent" (a persona) or "skill" (a reusable workflow the assistant applies on request).
	Kind    string `json:"kind"`
	Enabled bool   `json:"enabled"`
	// Schedule runs the agent by itself: none, daily, weekdays or weekly (on ScheduleDay, 0=Sunday).
	Schedule       string     `json:"schedule"`
	ScheduleTime   string     `json:"scheduleTime"`
	ScheduleDay    int        `json:"scheduleDay"`
	Timezone       string     `json:"timezone"`
	SchedulePrompt string     `json:"schedulePrompt"`
	ChannelID      *string    `json:"channelId"`
	NextRunAt      *time.Time `json:"nextRunAt"`
	LastRunAt      *time.Time `json:"lastRunAt"`
	LastResult     string     `json:"lastResult"`
	CreatedBy    *string   `json:"createdBy"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

const (
	KindAgent = "agent"
	KindSkill = "skill"
)

var (
	ErrSkillDisabled = apperror.Invalid("skill_disabled", "that skill is turned off")
	ErrAgentNotFound = apperror.NotFound("agent_not_found", "agent not found")
	ErrInvalidAgent  = apperror.Invalid("invalid_agent", "an agent needs a name (up to 80 characters) and instructions up to 4000 characters")
)

type AgentRepository interface {
	// Due lists agents whose next scheduled run has come, across workspaces.
	Due(ctx context.Context, now time.Time, limit int) ([]Agent, error)
	// Claim moves an agent's next run forward; false if another process already did.
	Claim(ctx context.Context, id string, from time.Time, next *time.Time) (bool, error)
	SaveRun(ctx context.Context, id, result string, at time.Time) error
	List(ctx context.Context, ws string) ([]Agent, error)
	Get(ctx context.Context, ws, id string) (*Agent, error)
	Create(ctx context.Context, a *Agent) error
	Update(ctx context.Context, a *Agent) error
	Delete(ctx context.Context, ws, id string) error
}
