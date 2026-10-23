// Package v1 exposes workspace use cases over HTTP.
package v1

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/application"
	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// SnapshotSource is the aggregated read model of a workspace (provided by the composition root).
type SnapshotSource interface {
	Snapshot(ctx context.Context, workspaceID, userID string) (map[string]any, error)
}

type Handler struct {
	svc      *application.Service
	snapshot SnapshotSource
}

func NewHandler(svc *application.Service, snapshot SnapshotSource) *Handler {
	return &Handler{svc: svc, snapshot: snapshot}
}

type createReq struct {
	ID    string `json:"id"`
	Name  string `json:"name" binding:"required,max=120"`
	Color string `json:"color"`
}

type updateReq struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

type inviteReq struct {
	Email string `json:"email" binding:"required,email"`
	Name  string `json:"name" binding:"max=255"`
	Role  string `json:"role" binding:"required"`
}

type roleReq struct {
	Role string `json:"role" binding:"required"`
}

func (h *Handler) List(c *gin.Context) {
	ws, err := h.svc.ListForUser(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, ws)
}

func (h *Handler) Create(c *gin.Context) {
	var req createReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	w, err := h.svc.Create(c.Request.Context(), authctx.UserID(c), req.ID, req.Name, req.Color)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, w)
}

func (h *Handler) Snapshot(c *gin.Context) {
	snap, err := h.snapshot.Snapshot(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, snap)
}

func (h *Handler) Update(c *gin.Context) {
	var req updateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	w, err := h.svc.Update(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), req.Name, req.Color)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, w)
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c)); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) Invite(c *gin.Context) {
	var req inviteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	m, err := h.svc.Invite(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), req.Email, req.Name, domain.Role(req.Role))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, m)
}

func (h *Handler) SetRole(c *gin.Context) {
	var req roleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	m, err := h.svc.SetRole(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("uid"), domain.Role(req.Role))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, m)
}

func (h *Handler) RemoveMember(c *gin.Context) {
	if err := h.svc.RemoveMember(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("uid")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// RegisterCollection mounts GET/POST /workspaces (rg requires auth).
func (h *Handler) RegisterCollection(rg *gin.RouterGroup) {
	rg.GET("", h.List)
	rg.POST("", h.Create)
}

// RegisterMember mounts routes on /workspaces/:wid (rg requires membership).
func (h *Handler) RegisterMember(rg *gin.RouterGroup) {
	rg.GET("/snapshot", h.Snapshot)
	rg.PATCH("", h.Update)
	rg.DELETE("", h.Delete)
	rg.POST("/members", h.Invite)
	rg.PATCH("/members/:uid", h.SetRole)
	rg.DELETE("/members/:uid", h.RemoveMember)
}
