package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/service"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type UserHandler struct {
	users *service.UserService
}

func NewUserHandler(users *service.UserService) *UserHandler {
	return &UserHandler{users: users}
}

// Me handles GET /users/me.
//
//	@Summary		Get current user
//	@Tags			users
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	userResponse
//	@Failure		401	{object}	response.ErrorResponse
//	@Failure		404	{object}	response.ErrorResponse
//	@Router			/users/me [get]
func (h *UserHandler) Me(c *gin.Context) {
	user, err := h.users.GetByID(c.Request.Context(), userIDFromContext(c))
	if err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusOK, newUserResponse(user))
}

// UpdateMe handles PATCH /users/me.
//
//	@Summary		Update current user profile
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		updateProfileRequest	true	"Profile fields to update"
//	@Success		200		{object}	userResponse
//	@Failure		400		{object}	response.ErrorResponse
//	@Failure		401		{object}	response.ErrorResponse
//	@Router			/users/me [patch]
func (h *UserHandler) UpdateMe(c *gin.Context) {
	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidation(c, err)
		return
	}
	user, err := h.users.UpdateProfile(c.Request.Context(), userIDFromContext(c), req.FullName)
	if err != nil {
		respondError(c, err)
		return
	}
	response.Data(c, http.StatusOK, newUserResponse(user))
}
