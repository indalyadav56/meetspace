// Package v1 exposes docs and whiteboards over HTTP.
package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/docs/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

type docReq struct {
	ID        string  `json:"id"`
	ProjectID *string `json:"projectId"`
	Title     string  `json:"title"`
	Content   string  `json:"content"`
	Emoji     string  `json:"emoji"`
}

type wbReq struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

func (h *Handler) createDoc(c *gin.Context) {
	var r docReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	d, err := h.svc.CreateDoc(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r.ID, r.ProjectID, r.Title, r.Content, r.Emoji)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, d)
}

func (h *Handler) updateDoc(c *gin.Context) {
	var r application.DocPatch
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	d, err := h.svc.UpdateDoc(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id"), r)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, d)
}

func (h *Handler) deleteDoc(c *gin.Context) {
	if err := h.svc.DeleteDoc(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) createWhiteboard(c *gin.Context) {
	var r wbReq
	_ = c.ShouldBindJSON(&r)
	w, err := h.svc.CreateWhiteboard(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r.ID, r.Title)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, w)
}

func (h *Handler) updateWhiteboard(c *gin.Context) {
	var r application.WhiteboardPatch
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	w, err := h.svc.UpdateWhiteboard(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id"), r)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, w)
}

func (h *Handler) deleteWhiteboard(c *gin.Context) {
	if err := h.svc.DeleteWhiteboard(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/docs", h.createDoc)
	rg.PATCH("/docs/:id", h.updateDoc)
	rg.DELETE("/docs/:id", h.deleteDoc)
	rg.POST("/whiteboards", h.createWhiteboard)
	rg.PATCH("/whiteboards/:id", h.updateWhiteboard)
	rg.DELETE("/whiteboards/:id", h.deleteWhiteboard)
	rg.GET("/trash/docs", h.listTrash)
	rg.POST("/dashboards", h.createDashboard)
	rg.PATCH("/dashboards/:id", h.updateDashboard)
	rg.DELETE("/dashboards/:id", h.deleteDashboard)
	rg.POST("/trash/:kind/:id/restore", h.restore)
	rg.DELETE("/trash/:kind/:id", h.purge)
}

func (h *Handler) listTrash(c *gin.Context) {
	items, err := h.svc.ListTrash(c.Request.Context(), authctx.WorkspaceID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, items)
}

func (h *Handler) restore(c *gin.Context) {
	if err := h.svc.Restore(c.Request.Context(), authctx.WorkspaceID(c), c.Param("kind"), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) purge(c *gin.Context) {
	if err := h.svc.Purge(c.Request.Context(), authctx.WorkspaceID(c), c.Param("kind"), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) saveDashboard(c *gin.Context, create bool) {
	var in application.DashboardInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, err)
		return
	}
	id := in.ID
	if !create {
		id = c.Param("id")
	}
	d, err := h.svc.SaveDashboard(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), id, in, create)
	if err != nil {
		response.FromError(c, err)
		return
	}
	status := http.StatusOK
	if create {
		status = http.StatusCreated
	}
	response.Data(c, status, d)
}

func (h *Handler) createDashboard(c *gin.Context) { h.saveDashboard(c, true) }
func (h *Handler) updateDashboard(c *gin.Context) { h.saveDashboard(c, false) }

func (h *Handler) deleteDashboard(c *gin.Context) {
	if err := h.svc.DeleteDashboard(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}
