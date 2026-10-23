// Package v1 exposes goals over HTTP.
package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/goals/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

type createReq struct {
	ID string `json:"id"`
}

func (h *Handler) create(c *gin.Context) {
	var r createReq
	_ = c.ShouldBindJSON(&r) // the body is optional
	g, err := h.svc.Create(c.Request.Context(), authctx.WorkspaceID(c), r.ID, authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, g)
}

func (h *Handler) update(c *gin.Context) {
	var p application.Patch
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, err)
		return
	}
	g, err := h.svc.Update(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id"), p)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, g)
}

func (h *Handler) delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/goals", h.create)
	rg.PATCH("/goals/:id", h.update)
	rg.DELETE("/goals/:id", h.delete)
}
