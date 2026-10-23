// Package v1 exposes meetings, calls and the LiveKit webhook over HTTP.
package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/meet/application"
	lk "github.com/indalyadav56/meetspace/backend/internal/meet/infrastructure/livekit"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	svc   *application.Service
	rooms *lk.Rooms // nil when LiveKit isn't configured
	log   *zap.Logger
}

func NewHandler(svc *application.Service, rooms *lk.Rooms, log *zap.Logger) *Handler {
	return &Handler{svc: svc, rooms: rooms, log: log}
}

type ringReq struct {
	UserIDs []string `json:"userIds" binding:"required,min=1"`
}

func reply(c *gin.Context, status int, v any, err error) {
	if err != nil {
		response.FromError(c, err)
		return
	}
	if v == nil {
		response.NoContent(c)
		return
	}
	response.Data(c, status, v)
}

func (h *Handler) createMeeting(c *gin.Context) {
	var in application.MeetingInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, err)
		return
	}
	m, err := h.svc.CreateMeeting(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), in)
	reply(c, http.StatusCreated, m, err)
}

func (h *Handler) updateMeeting(c *gin.Context) {
	var in application.MeetingInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, err)
		return
	}
	m, err := h.svc.UpdateMeeting(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id"), in)
	reply(c, http.StatusOK, m, err)
}

func (h *Handler) deleteMeeting(c *gin.Context) {
	reply(c, 0, nil, h.svc.DeleteMeeting(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id")))
}

func (h *Handler) startCall(c *gin.Context) {
	var in application.StartInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, err)
		return
	}
	j, err := h.svc.StartCall(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), in)
	reply(c, http.StatusCreated, j, err)
}

func (h *Handler) joinCall(c *gin.Context) {
	j, err := h.svc.JoinCall(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"))
	reply(c, http.StatusOK, j, err)
}

func (h *Handler) ring(c *gin.Context) {
	var r ringReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	reply(c, 0, nil, h.svc.Ring(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), r.UserIDs))
}

func (h *Handler) decline(c *gin.Context) {
	reply(c, 0, nil, h.svc.Decline(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")))
}

func (h *Handler) updateCall(c *gin.Context) {
	var p application.CallPatch
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, err)
		return
	}
	call, err := h.svc.UpdateCall(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id"), p)
	reply(c, http.StatusOK, call, err)
}

func (h *Handler) endCall(c *gin.Context) {
	reply(c, 0, nil, h.svc.EndCall(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")))
}

// Webhook receives LiveKit server events. The signature is checked against the API secret.
func (h *Handler) Webhook(c *gin.Context) {
	if h.rooms == nil {
		response.Error(c, http.StatusServiceUnavailable, "meetings_unavailable", "LiveKit is not configured")
		return
	}
	ev, err := h.rooms.Receive(c.Request)
	if err != nil {
		h.log.Warn("rejected livekit webhook", zap.Error(err))
		response.Error(c, http.StatusUnauthorized, "invalid_webhook", "invalid webhook signature")
		return
	}
	if err := h.svc.HandleRoomEvent(c.Request.Context(), ev.Event, ev.Room, ev.Identity); err != nil {
		response.FromError(c, err)
		return
	}
	c.Status(http.StatusOK)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/meetings", h.createMeeting)
	rg.PUT("/meetings/:id", h.updateMeeting)
	rg.DELETE("/meetings/:id", h.deleteMeeting)
	rg.POST("/calls", h.startCall)
	rg.POST("/calls/:id/join", h.joinCall)
	rg.POST("/calls/:id/ring", h.ring)
	rg.POST("/calls/:id/decline", h.decline)
	rg.POST("/calls/:id/end", h.endCall)
	rg.PATCH("/calls/:id", h.updateCall)
}
