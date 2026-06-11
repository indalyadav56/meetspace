// Package server is the app-specific routing layer. It knows the bounded
// contexts and stitches their routes together; lifecycle lives in
// pkg/httpserver, wiring in internal/di.
package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/di"
	appmw "github.com/indalyadav56/meetspace/backend/internal/server/middleware"

	calendarV1 "github.com/indalyadav56/meetspace/backend/internal/calendar/transport/http/v1"
	chatV1 "github.com/indalyadav56/meetspace/backend/internal/chat/transport/http/v1"
	tasksV1 "github.com/indalyadav56/meetspace/backend/internal/tasks/transport/http/v1"
	workspaceV1 "github.com/indalyadav56/meetspace/backend/internal/workspace/transport/http/v1"
)

func NewRouter(c *di.ServerContainer) http.Handler {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()

	// Engine-level: panic recovery runs for ALL routes including healthz.
	engine.Use(appmw.Recovery(c.Shared.Logger))

	// Operational endpoints — no version prefix.
	engine.GET("/healthz", livenessHandler)
	engine.GET("/readyz", readinessHandler(c))

	v1 := engine.Group("/api/v1")
	v1.Use(appmw.RequestID())
	v1.Use(appmw.Logger(c.Shared.Logger))
	{
		workspaceV1.RegisterRoutes(v1, c.WorkspaceHandler)
		tasksV1.RegisterRoutes(v1, c.TaskHandler)
		chatV1.RegisterRoutes(v1, c.ChatHandler)
		calendarV1.RegisterRoutes(v1, c.CalendarHandler)
	}

	return engine
}
