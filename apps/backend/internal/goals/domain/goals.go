// Package domain holds goals and their measurable targets.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Target struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Kind    string  `json:"kind"` // number | currency | boolean | tasks
	Start   float64 `json:"start"`
	Current float64 `json:"current"`
	Target  float64 `json:"target"`
	Unit    string  `json:"unit"`
	ListID  *string `json:"listId"`
}

type Goal struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Color       string    `json:"color"`
	OwnerID     string    `json:"ownerId"`
	DueDate     *string   `json:"dueDate"`
	Folder      string    `json:"folder"`
	Targets     []Target  `json:"targets"`
	CreatedAt   time.Time `json:"createdAt"`
}

var ErrNotFound = apperror.NotFound("goal_not_found", "goal not found")

type Repository interface {
	Create(ctx context.Context, g *Goal) error
	Get(ctx context.Context, ws, id string) (*Goal, error)
	List(ctx context.Context, ws string) ([]Goal, error)
	Update(ctx context.Context, g *Goal) error
	Delete(ctx context.Context, ws, id string) error
}
