// Package v1 exposes workspace use cases over HTTP.
package v1

import (
	"context"
	"encoding/json"
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

type teamReq struct {
	ID          string   `json:"id"`
	Name        string   `json:"name" binding:"required,max=80"`
	Color       string   `json:"color"`
	Description string   `json:"description" binding:"max=2000"`
	LeadID      *string  `json:"leadId"`
	Members     []string `json:"members" binding:"max=500"`
}

func (h *Handler) ListTeams(c *gin.Context) {
	ts, err := h.svc.ListTeams(c.Request.Context(), authctx.WorkspaceID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, ts)
}

func (h *Handler) saveTeam(c *gin.Context, create bool) {
	var req teamReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	id := req.ID
	if !create {
		id = c.Param("tid")
	}
	t, err := h.svc.SaveTeam(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), application.TeamInput{
		ID: id, Name: req.Name, Color: req.Color, Description: req.Description, LeadID: req.LeadID, Members: req.Members,
	}, create)
	if err != nil {
		response.FromError(c, err)
		return
	}
	status := http.StatusOK
	if create {
		status = http.StatusCreated
	}
	response.Data(c, status, t)
}

func (h *Handler) CreateTeam(c *gin.Context) { h.saveTeam(c, true) }
func (h *Handler) UpdateTeam(c *gin.Context) { h.saveTeam(c, false) }

func (h *Handler) DeleteTeam(c *gin.Context) {
	if err := h.svc.DeleteTeam(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("tid")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// profileReq: a key that is present with null clears the manager; an absent key leaves it.
type profileReq struct {
	Title     *string         `json:"title"`
	ManagerID json.RawMessage `json:"managerId"`
}

func (h *Handler) SetProfile(c *gin.Context) {
	var req profileReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	var manager *string
	setManager := len(req.ManagerID) > 0
	if setManager && string(req.ManagerID) != "null" {
		var id string
		if err := json.Unmarshal(req.ManagerID, &id); err != nil {
			response.BadRequest(c, err)
			return
		}
		manager = &id
	}
	m, err := h.svc.SetProfile(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("uid"), req.Title, manager, setManager)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, m)
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
	rg.PATCH("/members/:uid/profile", h.SetProfile)
	rg.GET("/teams", h.ListTeams)
	rg.POST("/teams", h.CreateTeam)
	rg.PATCH("/teams/:tid", h.UpdateTeam)
	rg.DELETE("/teams/:tid", h.DeleteTeam)
}
