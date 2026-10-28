// Package v1 exposes notifications and reminders over HTTP.
package v1

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/notify/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	svc      *application.Service
	delivery *application.Delivery
}

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

// WithDelivery adds the email and push settings endpoints.
func (h *Handler) WithDelivery(d *application.Delivery) *Handler {
	h.delivery = d
	return h
}

type patchNotificationReq struct {
	Read    *bool `json:"read"`
	Cleared *bool `json:"cleared"`
}

type reminderReq struct {
	ID     string    `json:"id"`
	Text   string    `json:"text" binding:"required"`
	Due    time.Time `json:"due" binding:"required"`
	TaskID *string   `json:"taskId"`
}

type patchReminderReq struct {
	Text *string    `json:"text"`
	Due  *time.Time `json:"due"`
	Done *bool      `json:"done"`
}

func (h *Handler) PatchNotification(c *gin.Context) {
	var req patchNotificationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	n, err := h.svc.Update(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), req.Read, req.Cleared)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, n)
}

func (h *Handler) ReadAll(c *gin.Context) {
	if err := h.svc.MarkAllRead(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c)); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) CreateReminder(c *gin.Context) {
	var req reminderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	if req.TaskID != nil && *req.TaskID == "" {
		req.TaskID = nil
	}
	r, err := h.svc.CreateReminder(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), req.ID, req.Text, req.Due, req.TaskID)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, r)
}

func (h *Handler) PatchReminder(c *gin.Context) {
	var req patchReminderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	r, err := h.svc.UpdateReminder(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), application.ReminderPatch{Text: req.Text, Due: req.Due, Done: req.Done})
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, r)
}

func (h *Handler) DeleteReminder(c *gin.Context) {
	if err := h.svc.DeleteReminder(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.PATCH("/notifications/:id", h.PatchNotification)
	rg.POST("/notifications/read-all", h.ReadAll)
	rg.POST("/reminders", h.CreateReminder)
	rg.PATCH("/reminders/:id", h.PatchReminder)
	rg.DELETE("/reminders/:id", h.DeleteReminder)
}
