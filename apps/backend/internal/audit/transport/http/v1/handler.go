// Package v1 exposes the audit log over HTTP.
package v1

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/audit/application"
	"github.com/indalyadav56/meetspace/backend/internal/audit/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

func filterFrom(c *gin.Context) domain.Filter {
	f := domain.Filter{
		WorkspaceID: authctx.WorkspaceID(c), ActorID: c.Query("actor"), Action: c.Query("action"),
		EntityType: c.Query("entity"), EntityID: c.Query("entityId"), Query: c.Query("q"), Before: c.Query("before"),
		Security: c.Query("security") != "0",
	}
	f.Limit, _ = strconv.Atoi(c.Query("limit"))
	for k, dst := range map[string]**time.Time{"from": &f.From, "to": &f.To} {
		if v := c.Query(k); v != "" {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				*dst = &t
			} else if t, err := time.Parse("2006-01-02", v); err == nil {
				if k == "to" {
					t = t.Add(24 * time.Hour)
				}
				*dst = &t
			}
		}
	}
	return f
}

func (h *Handler) list(c *gin.Context) {
	events, err := h.svc.List(c.Request.Context(), authctx.Role(c), filterFrom(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, events)
}

func (h *Handler) actions(c *gin.Context) {
	a, err := h.svc.Actions(c.Request.Context(), authctx.Role(c), authctx.WorkspaceID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, a)
}

// export streams the filtered log as CSV, newest first, up to 10,000 rows.
func (h *Handler) export(c *gin.Context) {
	f := filterFrom(c)
	f.Limit = 500
	var rows []domain.Event
	for len(rows) < 10000 {
		page, err := h.svc.List(c.Request.Context(), authctx.Role(c), f)
		if err != nil {
			response.FromError(c, err)
			return
		}
		rows = append(rows, page...)
		if len(page) < f.Limit {
			break
		}
		f.Before = page[len(page)-1].ID
	}
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="audit-log-`+time.Now().Format("2006-01-02")+`.csv"`)
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"time", "actor_id", "action", "entity_type", "entity_id", "summary", "fields", "ip", "user_agent", "route"})
	for _, e := range rows {
		actor := ""
		if e.ActorID != nil {
			actor = *e.ActorID
		}
		fields := ""
		if fs, ok := e.Meta["fields"].([]any); ok {
			parts := make([]string, 0, len(fs))
			for _, f := range fs {
				if s, ok := f.(string); ok {
					parts = append(parts, s)
				}
			}
			fields = strings.Join(parts, " ")
		}
		_ = w.Write([]string{e.CreatedAt.UTC().Format(time.RFC3339), actor, e.Action, e.EntityType, e.EntityID, e.Summary, fields, e.IP, e.UserAgent, e.Route})
	}
	w.Flush()
}

func (h *Handler) mine(c *gin.Context) {
	events, err := h.svc.Mine(c.Request.Context(), authctx.UserID(c), 50)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, events)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/audit", h.list)
	rg.GET("/audit/actions", h.actions)
	rg.GET("/audit/export", h.export)
}

// RegisterUser mounts the caller's own security activity on /users.
func (h *Handler) RegisterUser(rg *gin.RouterGroup) {
	rg.GET("/me/security-activity", h.mine)
}
