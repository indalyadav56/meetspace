// Package v1 exposes search over HTTP.
package v1

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/search/application"
	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	svc   *application.Service
	saved *application.SavedSearches
}

func NewHandler(svc *application.Service, saved *application.SavedSearches) *Handler {
	return &Handler{svc: svc, saved: saved}
}

func csv(v string) []string {
	var out []string
	for _, x := range strings.Split(v, ",") {
		if x = strings.TrimSpace(x); x != "" {
			out = append(out, x)
		}
	}
	return out
}

func day(v string, end bool) *time.Time {
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil
	}
	if end {
		t = t.Add(24 * time.Hour)
	}
	return &t
}

// search: GET /search?q=launch&type=task,doc&sort=recent&limit=20&author=u1&in=l1,l2&from=2026-10-01&to=2026-10-31
func (h *Handler) search(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	res, err := h.svc.Search(c.Request.Context(), domain.Query{
		WorkspaceID: authctx.WorkspaceID(c), UserID: authctx.UserID(c),
		Text: c.Query("q"), Types: csv(c.Query("type")), Sort: c.Query("sort"), Limit: limit,
		Authors: csv(c.Query("author")), Parents: csv(c.Query("in")), From: day(c.Query("from"), false), To: day(c.Query("to"), true),
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

func (h *Handler) listSaved(c *gin.Context) {
	list, err := h.saved.List(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, list)
}

func (h *Handler) save(c *gin.Context) {
	var r struct {
		Name  string         `json:"name"`
		Query map[string]any `json:"query"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	s, err := h.saved.Save(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r.Name, r.Query)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, s)
}

func (h *Handler) deleteSaved(c *gin.Context) {
	if err := h.saved.Delete(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/search", h.search)
	rg.GET("/search/status", h.status)
	rg.GET("/search/saved", h.listSaved)
	rg.POST("/search/saved", h.save)
	rg.DELETE("/search/saved/:id", h.deleteSaved)
}
