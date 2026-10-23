package v1

import "github.com/gin-gonic/gin"

// RouteDeps are the middlewares the composition root supplies.
type RouteDeps struct {
	AuthRequired gin.HandlerFunc
	LoginLimit   gin.HandlerFunc
	ForgotLimit  gin.HandlerFunc
}

// RegisterAuth mounts /auth routes on rg.
func (h *Handler) RegisterAuth(rg *gin.RouterGroup, d RouteDeps) {
	rg.POST("/register", d.LoginLimit, h.Register)
	rg.POST("/login", d.LoginLimit, h.Login)
	rg.POST("/refresh", h.Refresh)
	rg.POST("/forgot-password", d.ForgotLimit, h.ForgotPassword)
	rg.POST("/reset-password", h.ResetPassword)
	authed := rg.Group("", d.AuthRequired)
	authed.POST("/logout", h.Logout)
	authed.POST("/change-password", h.ChangePassword)
}

// RegisterUsers mounts /users routes on rg (rg must already require auth).
func (h *Handler) RegisterUsers(rg *gin.RouterGroup) {
	rg.GET("/me", h.Me)
	rg.PATCH("/me", h.UpdateMe)
}
