package v1

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/application"
	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	service *application.WorkspaceService
}

func NewHandler(s *application.WorkspaceService) *Handler {
	return &Handler{service: s}
}

func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.service.ListUsers(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	out := make([]UserResponse, 0, len(users))
	for i := range users {
		out = append(out, toUserResponse(&users[i]))
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) GetUser(c *gin.Context) {
	u, err := h.service.GetUser(c.Request.Context(), c.Param("userID"))
	if err != nil {
		writeWorkspaceError(c, err)
		return
	}
	response.Data(c, http.StatusOK, toUserResponse(u))
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	u, err := h.service.CreateUser(c.Request.Context(), application.CreateUserInput{
		Name: req.Name, Email: req.Email, Color: req.Color, Role: req.Role,
	})
	if err != nil {
		writeWorkspaceError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toUserResponse(u))
}

func (h *Handler) ListTeams(c *gin.Context) {
	teams, err := h.service.ListTeams(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	out := make([]TeamResponse, 0, len(teams))
	for i := range teams {
		out = append(out, toTeamResponse(&teams[i]))
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) GetTeam(c *gin.Context) {
	t, err := h.service.GetTeam(c.Request.Context(), c.Param("teamID"))
	if err != nil {
		writeWorkspaceError(c, err)
		return
	}
	response.Data(c, http.StatusOK, toTeamResponse(t))
}

func (h *Handler) CreateTeam(c *gin.Context) {
	var req CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	t, err := h.service.CreateTeam(c.Request.Context(), application.CreateTeamInput{
		Name: req.Name, Key: req.Key, Description: req.Description,
		Color: req.Color, Icon: req.Icon, LeadID: req.LeadID, MemberIDs: req.MemberIDs,
	})
	if err != nil {
		writeWorkspaceError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, toTeamResponse(t))
}

func writeWorkspaceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, domain.ErrUserNotFound), errors.Is(err, domain.ErrTeamNotFound):
		response.Error(c, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, domain.ErrEmailTaken), errors.Is(err, domain.ErrTeamKeyTaken):
		response.Error(c, http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, domain.ErrInvalidTeamKey):
		response.Error(c, http.StatusBadRequest, "invalid_request", err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal", err.Error())
	}
}
