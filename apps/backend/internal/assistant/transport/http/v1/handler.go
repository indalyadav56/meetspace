// Package v1 exposes the assistant over HTTP with Server-Sent Events.
package v1

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/assistant/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

type chatReq struct {
	Message   string `json:"message" binding:"required"`
	SessionID string `json:"sessionId"`
	Context   string `json:"context"`
}

func (h *Handler) status(c *gin.Context) {
	response.Data(c, http.StatusOK, gin.H{"enabled": h.svc.Enabled(), "model": h.svc.Model()})
}

// chat streams the agent's turn as text/event-stream, one JSON event per message.
func (h *Handler) chat(c *gin.Context) {
	var r chatReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	if !h.svc.Enabled() {
		response.FromError(c, application.ErrDisabled)
		return
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	flusher, _ := c.Writer.(http.Flusher)
	emit := func(e application.Event) {
		b, _ := json.Marshal(e)
		_, _ = c.Writer.Write([]byte("data: "))
		_, _ = c.Writer.Write(b)
		_, _ = c.Writer.Write([]byte("\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}
	err := h.svc.Chat(c.Request.Context(), application.RunRequest{
		WorkspaceID: authctx.WorkspaceID(c), UserID: authctx.UserID(c), SessionID: r.SessionID, Message: r.Message, Context: r.Context,
	}, emit)
	if err != nil {
		emit(application.Event{Type: "error", Text: err.Error()})
	}
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/assistant", h.status)
	rg.POST("/assistant/chat", h.chat)
}
