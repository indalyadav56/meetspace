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

type Handler struct {
	svc  *application.Service
	llm  application.LLM
	find application.Retriever
}

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

// WithAsk turns on "ask the workspace" answers grounded in search results.
func (h *Handler) WithAsk(llm application.LLM, find application.Retriever) *Handler {
	h.llm, h.find = llm, find
	return h
}

func (h *Handler) summarize(c *gin.Context) {
	var r struct {
		Title      string `json:"title"`
		Transcript string `json:"transcript" binding:"required"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	out, err := h.svc.Summarize(c.Request.Context(), r.Title, r.Transcript, h.llm)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) ask(c *gin.Context) {
	var r struct {
		Question string `json:"question" binding:"required"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	a, err := h.svc.Ask(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r.Question, h.llm, h.find)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, a)
}

type chatReq struct {
	AgentID   string `json:"agentId"`
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
		WorkspaceID: authctx.WorkspaceID(c), UserID: authctx.UserID(c), SessionID: r.SessionID, Message: r.Message, Context: r.Context, AgentID: r.AgentID,
	}, emit)
	if err != nil {
		emit(application.Event{Type: "error", Text: err.Error()})
	}
}

func (h *Handler) agents(c *gin.Context) {
	v, err := h.svc.Agents(c.Request.Context(), authctx.WorkspaceID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, v)
}

func (h *Handler) saveAgent(c *gin.Context) {
	var in application.AgentInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, err)
		return
	}
	ctx, ws := c.Request.Context(), authctx.WorkspaceID(c)
	var (
		v      any
		err    error
		status = http.StatusOK
	)
	if id := c.Param("id"); id != "" {
		v, err = h.svc.UpdateAgent(ctx, ws, id, in)
	} else {
		v, err = h.svc.CreateAgent(ctx, ws, authctx.UserID(c), in)
		status = http.StatusCreated
	}
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, status, v)
}

func (h *Handler) deleteAgent(c *gin.Context) {
	if err := h.svc.DeleteAgent(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/assistant", h.status)
	rg.POST("/assistant/chat", h.chat)
	rg.POST("/assistant/ask", h.ask)
	rg.POST("/assistant/summarize", h.summarize)
	rg.GET("/assistant/agents", h.agents)
	rg.POST("/assistant/agents", h.saveAgent)
	rg.PUT("/assistant/agents/:id", h.saveAgent)
	rg.DELETE("/assistant/agents/:id", h.deleteAgent)
}
