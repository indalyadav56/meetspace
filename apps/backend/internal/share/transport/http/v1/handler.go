// Package v1 exposes share links over HTTP.
package v1

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/share/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) get(c *gin.Context) {
	l, err := h.svc.Get(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("kind"), c.Param("id"))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, l)
}

func (h *Handler) enable(c *gin.Context) {
	var r struct {
		ExpiresAt *time.Time `json:"expiresAt"`
	}
	_ = c.ShouldBindJSON(&r)
	l, err := h.svc.Enable(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("kind"), c.Param("id"), r.ExpiresAt)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, l)
}

func (h *Handler) disable(c *gin.Context) {
	if err := h.svc.Disable(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("kind"), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) list(c *gin.Context) {
	links, err := h.svc.List(c.Request.Context(), authctx.WorkspaceID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, links)
}

func (h *Handler) open(c *gin.Context) {
	out, err := h.svc.Open(c.Request.Context(), c.Param("token"))
	if err != nil {
		response.FromError(c, err)
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Header("X-Robots-Tag", "noindex")
	response.Data(c, http.StatusOK, out)
}

// Register mounts member routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/share", h.list)
	rg.GET("/share/:kind/:id", h.get)
	rg.PUT("/share/:kind/:id", h.enable)
	rg.DELETE("/share/:kind/:id", h.disable)
}

// RegisterPublic mounts the token lookup for the public page.
func (h *Handler) RegisterPublic(rg *gin.RouterGroup, limit gin.HandlerFunc) {
	rg.GET("/share/:token", limit, h.open)
}
