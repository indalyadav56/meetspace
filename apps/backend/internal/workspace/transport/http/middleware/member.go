// Package middleware scopes requests to a workspace the caller belongs to.
package middleware

import (
	"context"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type RoleResolver interface {
	Role(ctx context.Context, workspaceID, userID string) (domain.Role, error)
}

// RequireMember reads :wid, verifies the authenticated user belongs to it and
// stores the workspace id and role on the context.
func RequireMember(r RoleResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		wid := c.Param("wid")
		role, err := r.Role(c.Request.Context(), wid, authctx.UserID(c))
		if err != nil {
			response.FromError(c, err)
			return
		}
		authctx.SetWorkspace(c, wid, string(role))
		c.Next()
	}
}

// DenyGuests blocks guests from mutating endpoints that need full membership.
func DenyGuests() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != "GET" && authctx.Role(c) == string(domain.RoleGuest) {
			response.FromError(c, domain.ErrForbidden)
			return
		}
		c.Next()
	}
}
