package service

import (
	"context"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/model"
	"github.com/indalyadav56/meetspace/backend/internal/repository"
)

// UserService handles reads and self-service updates of the authenticated user.
type UserService struct {
	users repository.UserRepository
}

// NewUserService wires the user service.
func NewUserService(users repository.UserRepository) *UserService {
	return &UserService{users: users}
}

// GetByID returns the user with the given id, or model.ErrUserNotFound.
func (s *UserService) GetByID(ctx context.Context, id string) (*model.User, error) {
	return s.users.GetByID(ctx, id)
}

// UpdateProfile updates the user's full name and returns the updated user.
func (s *UserService) UpdateProfile(ctx context.Context, id, fullName string) (*model.User, error) {
	return s.users.UpdateProfile(ctx, id, strings.TrimSpace(fullName))
}
