package domain

import "context"

type UserRepository interface {
	List(ctx context.Context) ([]User, error)
	FindByID(ctx context.Context, id string) (*User, error)
	Create(ctx context.Context, u *User) error
}

type TeamRepository interface {
	List(ctx context.Context) ([]Team, error)
	FindByID(ctx context.Context, id string) (*Team, error)
	Create(ctx context.Context, t *Team) error
}
