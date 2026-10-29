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
	rg.POST("/login/mfa", d.LoginLimit, h.LoginMFA)
	rg.GET("/providers", h.Providers)
	rg.GET("/oauth/:provider/start", d.LoginLimit, h.OAuthStart)
	rg.GET("/oauth/:provider/callback", d.LoginLimit, h.OAuthCallback)
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
	rg.GET("/me/2fa", h.twoFactor)
	rg.POST("/me/2fa/setup", h.setupTOTP)
	rg.POST("/me/2fa/enable", h.enableTOTP)
	rg.POST("/me/2fa/disable", h.disableTOTP)
	rg.POST("/me/2fa/recovery-codes", h.regenerateRecovery)
	rg.GET("/me/sessions", h.sessions)
	rg.DELETE("/me/sessions/:sid", h.revokeSession)
	rg.POST("/me/sessions/revoke-others", h.revokeOthers)
	rg.GET("/me/identities", h.identities)
	rg.GET("/me/consent", h.consent)
	rg.POST("/me/consent", h.acceptConsent)
}
