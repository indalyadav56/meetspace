package handler

import (
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/model"
	"github.com/indalyadav56/meetspace/backend/internal/service"
)

// --- requests ---

type registerRequest struct {
	Email    string `json:"email" binding:"required,email"`
	FullName string `json:"full_name" binding:"required,min=1,max=255"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type forgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8,max=72"`
}

type updateProfileRequest struct {
	FullName string `json:"full_name" binding:"required,min=1,max=255"`
}

// --- responses ---

type userResponse struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	FullName     string     `json:"full_name"`
	IsActive     bool       `json:"is_active"`
	IsSuperAdmin bool       `json:"is_super_admin"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func newUserResponse(u *model.User) userResponse {
	return userResponse{
		ID:           u.ID,
		Email:        u.Email,
		FullName:     u.FullName,
		IsActive:     u.IsActive,
		IsSuperAdmin: u.IsSuperAdmin,
		LastLoginAt:  u.LastLoginAt,
		CreatedAt:    u.CreatedAt,
		UpdatedAt:    u.UpdatedAt,
	}
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

func newTokenResponse(p *service.TokenPair) tokenResponse {
	return tokenResponse{
		AccessToken:  p.AccessToken,
		RefreshToken: p.RefreshToken,
		TokenType:    p.TokenType,
		ExpiresIn:    p.ExpiresIn,
	}
}

type authResponse struct {
	User  userResponse  `json:"user"`
	Token tokenResponse `json:"token"`
}

func newAuthResponse(u *model.User, p *service.TokenPair) authResponse {
	return authResponse{
		User:  newUserResponse(u),
		Token: newTokenResponse(p),
	}
}
