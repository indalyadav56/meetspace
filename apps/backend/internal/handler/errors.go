package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/middleware"
	"github.com/indalyadav56/meetspace/backend/internal/model"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

func respondError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrEmailExists):
		response.Error(c, http.StatusConflict, "email_exists", "email already registered")
	case errors.Is(err, model.ErrInvalidCredentials):
		response.Error(c, http.StatusUnauthorized, "invalid_credentials", "invalid email or password")
	case errors.Is(err, model.ErrUserInactive):
		response.Error(c, http.StatusForbidden, "user_inactive", "account is inactive")
	case errors.Is(err, model.ErrUserNotFound):
		response.Error(c, http.StatusNotFound, "not_found", "user not found")
	case errors.Is(err, model.ErrTokenExpired):
		response.Error(c, http.StatusUnauthorized, "token_expired", "token has expired")
	case errors.Is(err, model.ErrTokenNotFound),
		errors.Is(err, model.ErrTokenRevoked),
		errors.Is(err, model.ErrTokenReused):
		response.Error(c, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
	default:
		response.Error(c, http.StatusInternalServerError, "internal_error", "something went wrong")
	}
}

func respondValidation(c *gin.Context, err error) {
	response.Error(c, http.StatusBadRequest, "validation_error", err.Error())
}

func userIDFromContext(c *gin.Context) string {
	v, _ := c.Get(middleware.ContextUserID)
	id, _ := v.(string)
	return id
}

func sessionIDFromContext(c *gin.Context) string {
	v, _ := c.Get(middleware.ContextSessionID)
	id, _ := v.(string)
	return id
}
