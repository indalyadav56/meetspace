// Package v1 exposes identity use cases over HTTP.
package v1

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/identity/application"
	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
	"github.com/indalyadav56/meetspace/backend/internal/identity/infrastructure/oidc"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/optional"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// SecurityLog records account-level events (sign-ins, 2FA changes) for the audit trail.
type SecurityLog interface {
	Security(userID, action, ip, ua string, meta map[string]any)
}

type noLog struct{}

func (noLog) Security(string, string, string, string, map[string]any) {}

type Handler struct {
	auth      *application.AuthService
	users     *application.UserService
	log       SecurityLog
	providers []*oidc.Provider
	webURL    string
}

func NewHandler(auth *application.AuthService, users *application.UserService) *Handler {
	return &Handler{auth: auth, users: users, log: noLog{}}
}

// WithSecurity adds the audit trail and single sign-on providers.
func (h *Handler) WithSecurity(log SecurityLog, providers []*oidc.Provider, webURL string) *Handler {
	h.log, h.providers, h.webURL = log, providers, strings.TrimRight(webURL, "/")
	return h
}

// ctx carries the caller's IP and user agent so new sessions record them.
func ctx(c *gin.Context) context.Context {
	return application.WithClient(c.Request.Context(), c.ClientIP(), c.Request.UserAgent())
}

func (h *Handler) record(c *gin.Context, userID, action string, meta map[string]any) {
	h.log.Security(userID, action, c.ClientIP(), c.Request.UserAgent(), meta)
}

type registerReq struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	FullName string `json:"fullName" binding:"max=255"`
	Password string `json:"password" binding:"required"`
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type refreshReq struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type forgotReq struct {
	Email string `json:"email" binding:"required,email"`
}

type resetReq struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type changeReq struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword" binding:"required"`
}

type updateMeReq struct {
	FullName *string                             `json:"name"`
	Color    *string                             `json:"color"`
	Status   optional.Field[application.Status] `json:"status"`
}

type authResp struct {
	User   application.Profile    `json:"user"`
	Tokens *application.TokenPair `json:"tokens"`
}

// Register godoc
//
//	@Summary	Create an account
//	@Tags		auth
//	@Accept		json
//	@Produce	json
//	@Param		body	body		registerReq	true	"credentials"
//	@Success	201		{object}	authResp
//	@Failure	409		{object}	response.ErrorResponse
//	@Router		/auth/register [post]
func (h *Handler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	u, pair, err := h.auth.Register(ctx(c), req.Email, req.FullName, req.Password)
	if err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, u.ID, "auth.registered", nil)
	response.Data(c, http.StatusCreated, authResp{User: application.Profile{ID: u.ID, Name: u.FullName, Email: u.Email, Color: u.Color}, Tokens: pair})
}

// Login godoc
//
//	@Summary	Sign in
//	@Tags		auth
//	@Accept		json
//	@Produce	json
//	@Param		body	body		loginReq	true	"credentials"
//	@Success	200		{object}	authResp
//	@Failure	401		{object}	response.ErrorResponse
//	@Router		/auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	u, pair, err := h.auth.Login(ctx(c), req.Email, req.Password)
	var mfa *application.MFARequired
	if errors.As(err, &mfa) {
		response.Data(c, http.StatusOK, gin.H{"mfaRequired": true, "mfaToken": mfa.Token})
		return
	}
	if err != nil {
		if errors.Is(err, domain.ErrInvalidCredentials) {
			if id := h.auth.UserIDByEmail(c.Request.Context(), req.Email); id != "" {
				h.record(c, id, "auth.login_failed", map[string]any{"method": "password"})
			}
		}
		response.FromError(c, err)
		return
	}
	h.record(c, u.ID, "auth.login", map[string]any{"method": "password"})
	response.Data(c, http.StatusOK, authResp{User: application.Profile{ID: u.ID, Name: u.FullName, Email: u.Email, Color: u.Color}, Tokens: pair})
}

func (h *Handler) Refresh(c *gin.Context) {
	var req refreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	pair, err := h.auth.Refresh(ctx(c), req.RefreshToken)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, pair)
}

func (h *Handler) Logout(c *gin.Context) {
	if err := h.auth.Logout(c.Request.Context(), authctx.SessionID(c)); err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, authctx.UserID(c), "auth.logout", nil)
	response.NoContent(c)
}

func (h *Handler) ForgotPassword(c *gin.Context) {
	var req forgotReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	if err := h.auth.ForgotPassword(c.Request.Context(), req.Email); err != nil {
		response.FromError(c, err)
		return
	}
	// Same response whether or not the email exists.
	response.Data(c, http.StatusAccepted, gin.H{"sent": true})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	var req resetReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	if err := h.auth.ResetPassword(c.Request.Context(), req.Token, req.Password); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) ChangePassword(c *gin.Context) {
	var req changeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	pair, err := h.auth.ChangePassword(ctx(c), authctx.UserID(c), req.CurrentPassword, req.NewPassword)
	if err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, authctx.UserID(c), "auth.password_changed", nil)
	response.Data(c, http.StatusOK, pair)
}

func (h *Handler) Me(c *gin.Context) {
	p, err := h.users.Me(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, p)
}

func (h *Handler) UpdateMe(c *gin.Context) {
	var req updateMeReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	p, err := h.users.UpdateMe(c.Request.Context(), authctx.UserID(c), req.FullName, req.Color)
	if err == nil && req.Status.Set {
		p, err = h.users.SetStatus(c.Request.Context(), authctx.UserID(c), req.Status.Value)
	}
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, p)
}
