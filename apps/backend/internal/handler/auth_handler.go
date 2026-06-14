package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/service"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type AuthHandler struct {
	auth             *service.AuthService
	exposeResetToken bool
}

func NewAuthHandler(auth *service.AuthService, exposeResetToken bool) *AuthHandler {
	return &AuthHandler{auth: auth, exposeResetToken: exposeResetToken}
}

// Register handles POST /auth/register.
//
//	@Summary		Register a new user
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		registerRequest	true	"Registration payload"
//	@Success		201		{object}	authResponse
//	@Failure		400		{object}	response.ErrorResponse
//	@Failure		409		{object}	response.ErrorResponse
//	@Router			/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidation(c, err)
		return
	}
	user, pair, err := h.auth.Register(c.Request.Context(), req.Email, req.FullName, req.Password)
	if err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, newAuthResponse(user, pair))
}

// Login handles POST /auth/login.
//
//	@Summary		Login
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		loginRequest	true	"Login credentials"
//	@Success		200		{object}	authResponse
//	@Failure		400		{object}	response.ErrorResponse
//	@Failure		401		{object}	response.ErrorResponse
//	@Failure		429		{object}	response.ErrorResponse
//	@Router			/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidation(c, err)
		return
	}
	user, pair, err := h.auth.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusOK, newAuthResponse(user, pair))
}

// Refresh handles POST /auth/refresh.
//
//	@Summary		Refresh tokens
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		refreshRequest	true	"Refresh token"
//	@Success		200		{object}	tokenResponse
//	@Failure		400		{object}	response.ErrorResponse
//	@Failure		401		{object}	response.ErrorResponse
//	@Router			/auth/refresh [post]
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidation(c, err)
		return
	}
	pair, err := h.auth.Refresh(c.Request.Context(), req.RefreshToken)
	if err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusOK, newTokenResponse(pair))
}

// Logout handles POST /auth/logout. It requires authentication and revokes the
// current session.
//
//	@Summary		Logout
//	@Tags			auth
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	map[string]string
//	@Failure		401	{object}	response.ErrorResponse
//	@Router			/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	sessionID := sessionIDFromContext(c)
	if err := h.auth.Logout(c.Request.Context(), sessionID); err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusOK, gin.H{"message": "logged out"})
}

// ChangePassword handles POST /auth/change-password. It requires authentication,
// verifies the current password, and returns a fresh token pair.
//
//	@Summary		Change password
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		changePasswordRequest	true	"Passwords"
//	@Success		200		{object}	tokenResponse
//	@Failure		400		{object}	response.ErrorResponse
//	@Failure		401		{object}	response.ErrorResponse
//	@Router			/auth/change-password [post]
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidation(c, err)
		return
	}
	pair, err := h.auth.ChangePassword(c.Request.Context(), userIDFromContext(c), req.CurrentPassword, req.NewPassword)
	if err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusOK, newTokenResponse(pair))
}

// ForgotPassword handles POST /auth/forgot-password. It always responds with a
// generic success so the endpoint cannot be used to discover which emails are
// registered.
//
//	@Summary		Forgot password
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		forgotPasswordRequest	true	"Email address"
//	@Success		200		{object}	map[string]string
//	@Failure		400		{object}	response.ErrorResponse
//	@Failure		429		{object}	response.ErrorResponse
//	@Router			/auth/forgot-password [post]
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req forgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidation(c, err)
		return
	}
	token, err := h.auth.ForgotPassword(c.Request.Context(), req.Email)
	if err != nil {
		respondError(c, err)
		return
	}
	body := gin.H{"message": "if the email is registered, a reset link has been sent"}
	if h.exposeResetToken && token != "" {
		body["reset_token"] = token
	}
	response.Data(c, http.StatusOK, body)
}

// ResetPassword handles POST /auth/reset-password.
//
//	@Summary		Reset password
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		resetPasswordRequest	true	"Reset token and new password"
//	@Success		200		{object}	map[string]string
//	@Failure		400		{object}	response.ErrorResponse
//	@Failure		401		{object}	response.ErrorResponse
//	@Router			/auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req resetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidation(c, err)
		return
	}
	if err := h.auth.ResetPassword(c.Request.Context(), req.Token, req.Password); err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusOK, gin.H{"message": "password has been reset"})
}
