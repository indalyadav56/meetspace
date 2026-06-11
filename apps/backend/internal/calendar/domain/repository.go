package domain

import (
	"context"
	"time"
)

type ListFilter struct {
	From time.Time
	To   time.Time
}

type Repository interface {
	List(ctx context.Context, f ListFilter) ([]Meeting, error)
	FindByID(ctx context.Context, id string) (*Meeting, error)
	Create(ctx context.Context, m *Meeting) error
}
