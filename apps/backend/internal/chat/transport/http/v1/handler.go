// Package v1 exposes chat over HTTP.
package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/chat/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

type channelReq struct {
	ID    string `json:"id"`
	Name  string `json:"name" binding:"required"`
	Topic string `json:"topic"`
}

type dmReq struct {
	ID     string `json:"id"`
	UserID string `json:"userId" binding:"required"`
}

type editReq struct {
	Text string `json:"text" binding:"required"`
}

type reactReq struct {
	Emoji string `json:"emoji" binding:"required"`
}

type toTaskReq struct {
	TaskID string `json:"taskId"` // optional client-generated id for the new task
	ListID string `json:"listId" binding:"required"`
}

func ok(c *gin.Context, status int, v any, err error) {
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

func (h *Handler) createChannel(c *gin.Context) {
	var r channelReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	ch, err := h.svc.CreateChannel(c.Request.Context(), authctx.WorkspaceID(c), r.ID, r.Name, r.Topic)
	ok(c, http.StatusCreated, ch, err)
}

func (h *Handler) openDM(c *gin.Context) {
	var r dmReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	ch, err := h.svc.OpenDM(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r.ID, r.UserID)
	ok(c, http.StatusOK, ch, err)
}

func (h *Handler) send(c *gin.Context) {
	var r application.SendInput
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	r.ChannelID = c.Param("id")
	m, err := h.svc.Send(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r)
	ok(c, http.StatusCreated, m, err)
}

func (h *Handler) read(c *gin.Context) {
	ok(c, 0, nil, h.svc.MarkRead(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")))
}

func (h *Handler) edit(c *gin.Context) {
	var r editReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	m, err := h.svc.Edit(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), r.Text)
	ok(c, http.StatusOK, m, err)
}

func (h *Handler) delete(c *gin.Context) {
	ok(c, 0, nil, h.svc.Delete(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")))
}

func (h *Handler) react(c *gin.Context) {
	var r reactReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	m, err := h.svc.ToggleReaction(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), r.Emoji)
	ok(c, http.StatusOK, m, err)
}

func (h *Handler) toTask(c *gin.Context) {
	var r toTaskReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	m, err := h.svc.ToTask(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), r.TaskID, r.ListID)
	ok(c, http.StatusOK, m, err)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/channels", h.createChannel)
	rg.POST("/channels/dm", h.openDM)
	rg.POST("/channels/:id/messages", h.send)
	rg.POST("/channels/:id/read", h.read)
	rg.PATCH("/messages/:id", h.edit)
	rg.DELETE("/messages/:id", h.delete)
	rg.POST("/messages/:id/reactions", h.react)
	rg.POST("/messages/:id/task", h.toTask)
}
