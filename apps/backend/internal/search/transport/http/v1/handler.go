// Package v1 exposes search over HTTP.
package v1

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/search/application"
	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

// search: GET /search?q=launch&type=task,doc&sort=recent&limit=20
func (h *Handler) search(c *gin.Context) {
	var types []string
	for _, t := range strings.Split(c.Query("type"), ",") {
		if t = strings.TrimSpace(t); t != "" {
			types = append(types, t)
		}
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	res, err := h.svc.Search(c.Request.Context(), domain.Query{
		WorkspaceID: authctx.WorkspaceID(c), UserID: authctx.UserID(c),
		Text: c.Query("q"), Types: types, Sort: c.Query("sort"), Limit: limit,
	})
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, res)
}

func (h *Handler) status(c *gin.Context) {
	response.Data(c, http.StatusOK, gin.H{"enabled": h.svc.Enabled()})
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/search", h.search)
	rg.GET("/search/status", h.status)
}
