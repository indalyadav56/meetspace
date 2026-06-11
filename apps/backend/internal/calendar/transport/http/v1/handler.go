package v1

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/calendar/application"
	"github.com/indalyadav56/meetspace/backend/internal/calendar/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	service *application.CalendarService
}

func NewHandler(s *application.CalendarService) *Handler {
	return &Handler{service: s}
}

func (h *Handler) List(c *gin.Context) {
	var f domain.ListFilter
	if v := c.Query("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "from must be RFC3339")
			return
		}
		f.From = t
	}
	if v := c.Query("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "invalid_request", "to must be RFC3339")
			return
		}
		f.To = t
	}
	meetings, err := h.service.List(c.Request.Context(), f)
	if err != nil {
		writeCalendarError(c, err)
		return
	}
	out := make([]MeetingResponse, 0, len(meetings))
	for i := range meetings {
		out = append(out, toMeetingResponse(&meetings[i]))
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) Get(c *gin.Context) {
	m, err := h.service.Get(c.Request.Context(), c.Param("meetingID"))
	if err != nil {
		writeCalendarError(c, err)
		return
	}
	response.Data(c, http.StatusOK, toMeetingResponse(m))
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	m, err := h.service.Create(c.Request.Context(), application.CreateMeetingInput{
		Title:       req.Title,
		Description: req.Description,
		OrganizerID: req.OrganizerID,
		AttendeeIDs: req.AttendeeIDs,
		ChannelID:   req.ChannelID,
		StartsAt:    req.StartsAt,
		EndsAt:      req.EndsAt,
	})
	if err != nil {
		writeCalendarError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toMeetingResponse(m))
}

func writeCalendarError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrMeetingNotFound):
		response.Error(c, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, domain.ErrInvalidTimeSpan):
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal", err.Error())
	}
}
