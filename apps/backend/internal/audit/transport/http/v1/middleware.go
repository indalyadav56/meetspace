package v1

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/audit/application"
	"github.com/indalyadav56/meetspace/backend/internal/audit/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
)

const maxCapture = 64 << 10

// quiet are routes that change only the caller's own view (read markers,
// presence) or are queries sent as POST; auditing them would bury real changes.
var quiet = []string{"/read", "/notifications", "/assistant/chat", "/search", "/presence", "/typing", "/ask"}

// capture keeps a copy of the response body so the event can name what changed.
type capture struct {
	gin.ResponseWriter
	buf bytes.Buffer
}

func (w *capture) Write(b []byte) (int, error) {
	if w.buf.Len() < maxCapture {
		w.buf.Write(b[:min(len(b), maxCapture-w.buf.Len())])
	}
	return w.ResponseWriter.Write(b)
}

// Middleware audits every successful change made inside a workspace. prefix is
// the route prefix the workspace group is mounted at (e.g. /api/v1/workspaces/:wid).
func Middleware(svc *application.Service, prefix string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}
		route := strings.TrimPrefix(c.FullPath(), prefix)
		for _, q := range quiet {
			if strings.Contains(route, q) {
				c.Next()
				return
			}
		}
		// Only the field names of a JSON body are kept: values may be private.
		var fields []string
		var reqBody map[string]any
		if strings.HasPrefix(c.ContentType(), "application/json") && c.Request.ContentLength <= maxCapture {
			raw, _ := io.ReadAll(io.LimitReader(c.Request.Body, maxCapture))
			c.Request.Body = io.NopCloser(bytes.NewReader(raw))
			if json.Unmarshal(raw, &reqBody) == nil {
				for k := range reqBody {
					fields = append(fields, k)
				}
			}
		}
		w := &capture{ResponseWriter: c.Writer}
		c.Writer = w
		c.Next()

		status := c.Writer.Status()
		if status >= 400 {
			return
		}
		action, entity := application.Describe(c.Request.Method, route)
		ws, actor := authctx.WorkspaceID(c), authctx.UserID(c)
		e := domain.Event{
			WorkspaceID: &ws, ActorID: &actor, Action: action, Route: c.Request.Method + " " + route,
			EntityType: entity, IP: c.ClientIP(), UserAgent: c.Request.UserAgent(), Status: status,
		}
		for _, p := range []string{"id", "userId", "taskId", "docId"} {
			if v := c.Param(p); v != "" {
				e.EntityID = v
				break
			}
		}
		var resp struct {
			Data map[string]any `json:"data"`
		}
		_ = json.Unmarshal(w.buf.Bytes(), &resp)
		if e.EntityID == "" {
			e.EntityID, _ = resp.Data["id"].(string)
		}
		e.Summary = describeTarget(resp.Data, reqBody)
		if len(fields) > 0 {
			e.Meta = map[string]any{"fields": fields}
		}
		svc.Record(e)
	}
}

// describeTarget picks a human label for the changed item.
func describeTarget(sources ...map[string]any) string {
	for _, src := range sources {
		for _, k := range []string{"title", "name", "text", "email"} {
			if v, ok := src[k].(string); ok && strings.TrimSpace(v) != "" {
				return v
			}
		}
	}
	return ""
}
