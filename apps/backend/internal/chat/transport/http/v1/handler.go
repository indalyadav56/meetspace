package v1

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/chat/application"
	"github.com/indalyadav56/meetspace/backend/internal/chat/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	service *application.ChatService
}

func NewHandler(s *application.ChatService) *Handler {
	return &Handler{service: s}
}

func (h *Handler) ListChannels(c *gin.Context) {
	channels, err := h.service.ListChannels(c.Request.Context(), c.Param("teamID"))
	if err != nil {
		writeChatError(c, err)
		return
	}
	out := make([]ChannelResponse, 0, len(channels))
	for i := range channels {
		out = append(out, toChannelResponse(&channels[i]))
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) CreateChannel(c *gin.Context) {
	var req CreateChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	ch, err := h.service.CreateChannel(c.Request.Context(), application.CreateChannelInput{
		TeamID:      c.Param("teamID"),
		Name:        req.Name,
		Description: req.Description,
		Private:     req.Private,
	})
	if err != nil {
		writeChatError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toChannelResponse(ch))
}

func (h *Handler) ListMessages(c *gin.Context) {
	messages, err := h.service.Messages(c.Request.Context(), c.Param("conversationID"))
	if err != nil {
		writeChatError(c, err)
		return
	}
	out := make([]MessageResponse, 0, len(messages))
	for i := range messages {
		out = append(out, toMessageResponse(&messages[i]))
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) SendMessage(c *gin.Context) {
	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	m, err := h.service.Send(c.Request.Context(), application.SendMessageInput{
		ConversationID: c.Param("conversationID"),
		AuthorID:       req.AuthorID,
		Body:           req.Body,
		ParentID:       req.ParentID,
	})
	if err != nil {
		writeChatError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toMessageResponse(m))
}

func writeChatError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrChannelNotFound), errors.Is(err, domain.ErrMessageNotFound):
		response.Error(c, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, application.ErrUnknownTeam):
		response.Error(c, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, domain.ErrEmptyBody):
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal", err.Error())
	}
}
