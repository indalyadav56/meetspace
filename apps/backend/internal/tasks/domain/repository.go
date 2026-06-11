package domain

import "context"

type ListFilter struct {
	TeamID     string
	Status     Status
	AssigneeID string
}

type Repository interface {
	List(ctx context.Context, f ListFilter) ([]Task, error)
	FindByID(ctx context.Context, id string) (*Task, error)
	Create(ctx context.Context, t *Task) error
	Update(ctx context.Context, t *Task) error
	Delete(ctx context.Context, id string) error
	// NextKeyNumber atomically increments and returns the per-team task counter.
	NextKeyNumber(ctx context.Context, teamID string) (int, error)
}
