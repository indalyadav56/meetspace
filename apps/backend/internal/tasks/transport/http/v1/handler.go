package v1

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/tasks/application"
	"github.com/indalyadav56/meetspace/backend/internal/tasks/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	service *application.TaskService
}

func NewHandler(s *application.TaskService) *Handler {
	return &Handler{service: s}
}

func (h *Handler) List(c *gin.Context) {
	tasks, err := h.service.List(c.Request.Context(), domain.ListFilter{
		TeamID:     c.Query("teamId"),
		Status:     domain.Status(c.Query("status")),
		AssigneeID: c.Query("assigneeId"),
	})
	if err != nil {
		writeTaskError(c, err)
		return
	}
	out := make([]TaskResponse, 0, len(tasks))
	for i := range tasks {
		out = append(out, toTaskResponse(&tasks[i]))
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) Get(c *gin.Context) {
	t, err := h.service.Get(c.Request.Context(), c.Param("taskID"))
	if err != nil {
		writeTaskError(c, err)
		return
	}
	response.Data(c, http.StatusOK, toTaskResponse(t))
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	due, err := parseDue(req.DueDate)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	t, err := h.service.Create(c.Request.Context(), application.CreateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Status:      domain.Status(req.Status),
		Priority:    domain.Priority(req.Priority),
		Type:        req.Type,
		TeamID:      req.TeamID,
		AssigneeIDs: req.AssigneeIDs,
		Tags:        req.Tags,
		DueDate:     due,
	})
	if err != nil {
		writeTaskError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toTaskResponse(t))
}

func (h *Handler) Update(c *gin.Context) {
	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	in := application.UpdateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		AssigneeIDs: req.AssigneeIDs,
		Tags:        req.Tags,
	}
	if req.Status != nil {
		s := domain.Status(*req.Status)
		in.Status = &s
	}
	if req.Priority != nil {
		p := domain.Priority(*req.Priority)
		in.Priority = &p
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			in.ClearDue = true
		} else {
			due, err := parseDue(req.DueDate)
			if err != nil {
				response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
				return
			}
			in.DueDate = due
		}
	}
	t, err := h.service.Update(c.Request.Context(), c.Param("taskID"), in)
	if err != nil {
		writeTaskError(c, err)
		return
	}
	response.Data(c, http.StatusOK, toTaskResponse(t))
}

func (h *Handler) Move(c *gin.Context) {
	var req MoveTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	t, err := h.service.Move(c.Request.Context(), c.Param("taskID"), domain.Status(req.Status))
	if err != nil {
		writeTaskError(c, err)
		return
	}
	response.Data(c, http.StatusOK, toTaskResponse(t))
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.service.Delete(c.Request.Context(), c.Param("taskID")); err != nil {
		writeTaskError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) AddSubtask(c *gin.Context) {
	var req AddSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	t, err := h.service.AddSubtask(c.Request.Context(), c.Param("taskID"), req.Title)
	if err != nil {
		writeTaskError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toTaskResponse(t))
}

func (h *Handler) ToggleSubtask(c *gin.Context) {
	t, err := h.service.ToggleSubtask(c.Request.Context(), c.Param("taskID"), c.Param("subtaskID"))
	if err != nil {
		writeTaskError(c, err)
		return
	}
	response.Data(c, http.StatusOK, toTaskResponse(t))
}

func (h *Handler) AddComment(c *gin.Context) {
	var req AddCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	t, err := h.service.AddComment(c.Request.Context(), c.Param("taskID"), req.AuthorID, req.Body)
	if err != nil {
		writeTaskError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toTaskResponse(t))
}

func parseDue(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, errors.New("dueDate must be YYYY-MM-DD")
	}
	return &t, nil
}

func writeTaskError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrTaskNotFound), errors.Is(err, domain.ErrSubtaskNotFound):
		response.Error(c, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, domain.ErrInvalidStatus), errors.Is(err, domain.ErrInvalidPriority):
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
	case errors.Is(err, application.ErrUnknownTeam):
		response.Error(c, http.StatusUnprocessableEntity, "unknown_team", err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal", err.Error())
	}
}
