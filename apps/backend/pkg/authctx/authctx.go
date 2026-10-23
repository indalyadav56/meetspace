// Package authctx carries the authenticated principal and the selected tenant
// through a gin request context. It knows nothing about how they were resolved.
package authctx

import "github.com/gin-gonic/gin"

const (
	keyUserID      = "authctx.user_id"
	keySessionID   = "authctx.session_id"
	keyWorkspaceID = "authctx.workspace_id"
	keyRole        = "authctx.role"
)

func SetUser(c *gin.Context, userID, sessionID string) {
	c.Set(keyUserID, userID)
	c.Set(keySessionID, sessionID)
}

func SetWorkspace(c *gin.Context, workspaceID, role string) {
	c.Set(keyWorkspaceID, workspaceID)
	c.Set(keyRole, role)
}

func UserID(c *gin.Context) string      { return c.GetString(keyUserID) }
func SessionID(c *gin.Context) string   { return c.GetString(keySessionID) }
func WorkspaceID(c *gin.Context) string { return c.GetString(keyWorkspaceID) }
func Role(c *gin.Context) string        { return c.GetString(keyRole) }
