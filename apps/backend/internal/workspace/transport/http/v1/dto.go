package v1

import (
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

type UserResponse struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Email         string    `json:"email"`
	Initials      string    `json:"initials"`
	Color         string    `json:"color"`
	Role          string    `json:"role"`
	Presence      string    `json:"presence"`
	StatusMessage string    `json:"statusMessage,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

func toUserResponse(u *domain.User) UserResponse {
	return UserResponse{
		ID:            u.ID,
		Name:          u.Name,
		Email:         u.Email,
		Initials:      u.Initials,
		Color:         u.Color,
		Role:          u.Role,
		Presence:      string(u.Presence),
		StatusMessage: u.StatusMessage,
		CreatedAt:     u.CreatedAt,
	}
}

type CreateUserRequest struct {
	Name  string `json:"name" binding:"required"`
	Email string `json:"email" binding:"required,email"`
	Color string `json:"color"`
	Role  string `json:"role"`
}

type TeamResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Key         string    `json:"key"`
	Description string    `json:"description"`
	Color       string    `json:"color"`
	Icon        string    `json:"icon"`
	LeadID      string    `json:"leadId"`
	MemberIDs   []string  `json:"memberIds"`
	CreatedAt   time.Time `json:"createdAt"`
}

func toTeamResponse(t *domain.Team) TeamResponse {
	members := t.MemberIDs
	if members == nil {
		members = []string{}
	}
	return TeamResponse{
		ID:          t.ID,
		Name:        t.Name,
		Key:         t.Key,
		Description: t.Description,
		Color:       t.Color,
		Icon:        t.Icon,
		LeadID:      t.LeadID,
		MemberIDs:   members,
		CreatedAt:   t.CreatedAt,
	}
}

type CreateTeamRequest struct {
	Name        string   `json:"name" binding:"required"`
	Key         string   `json:"key" binding:"required"`
	Description string   `json:"description"`
	Color       string   `json:"color"`
	Icon        string   `json:"icon"`
	LeadID      string   `json:"leadId"`
	MemberIDs   []string `json:"memberIds"`
}
