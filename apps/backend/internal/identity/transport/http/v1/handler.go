// Package v1 exposes identity use cases over HTTP.
package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/identity/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	auth  *application.AuthService
	users *application.UserService
}

func NewHandler(auth *application.AuthService, users *application.UserService) *Handler {
	return &Handler{auth: auth, users: users}
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
	FullName *string `json:"name"`
	Color    *string `json:"color"`
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
	u, pair, err := h.auth.Register(c.Request.Context(), req.Email, req.FullName, req.Password)
	if err != nil {
		response.FromError(c, err)
		return
	}
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
	u, pair, err := h.auth.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, authResp{User: application.Profile{ID: u.ID, Name: u.FullName, Email: u.Email, Color: u.Color}, Tokens: pair})
}

func (h *Handler) Refresh(c *gin.Context) {
	var req refreshReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	pair, err := h.auth.Refresh(c.Request.Context(), req.RefreshToken)
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
	pair, err := h.auth.ChangePassword(c.Request.Context(), authctx.UserID(c), req.CurrentPassword, req.NewPassword)
	if err != nil {
		response.FromError(c, err)
		return
	}
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
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, p)
}
