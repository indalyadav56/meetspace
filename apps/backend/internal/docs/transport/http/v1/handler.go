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
	if err := h.svc.DeleteDoc(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id")); err != nil {
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
	if err := h.svc.DeleteWhiteboard(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id")); err != nil {
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
}
