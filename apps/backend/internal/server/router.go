// Package server assembles the gin engine: global middleware, health checks
// and the versioned route tree. It knows routes, not how handlers are built.
package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.uber.org/zap"

	_ "github.com/indalyadav56/meetspace/backend/docs/swagger" // generated swagger docs
	auditv1 "github.com/indalyadav56/meetspace/backend/internal/audit/transport/http/v1"
	"github.com/indalyadav56/meetspace/backend/internal/di"
	authmw "github.com/indalyadav56/meetspace/backend/internal/identity/transport/http/middleware"
	identityhttp "github.com/indalyadav56/meetspace/backend/internal/identity/transport/http/v1"
	"github.com/indalyadav56/meetspace/backend/internal/server/middleware"
	wsmw "github.com/indalyadav56/meetspace/backend/internal/workspace/transport/http/middleware"
	"github.com/indalyadav56/meetspace/backend/pkg/logger"
	"github.com/indalyadav56/meetspace/backend/pkg/ratelimit"
)

type Options struct {
	Handlers       di.Handlers
	Log            *zap.Logger
	AllowedOrigins []string
	Ready          func(context.Context) error
	ReleaseMode    bool
}

func NewRouter(o Options) *gin.Engine {
	if o.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	}
	h := o.Handlers

	r := gin.New()
	r.Use(middleware.Recovery(o.Log), logger.LoggerMiddleware(o.Log), middleware.CORS(o.AllowedOrigins))

	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
	r.GET("/readyz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := o.Ready(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	authRequired := authmw.AuthRequired(h.Signer)
	v1 := r.Group("/api/v1")

	h.Identity.RegisterAuth(v1.Group("/auth"), identityhttp.RouteDeps{
		AuthRequired: authRequired,
		LoginLimit:   ratelimit.New(20, time.Minute).Middleware(),
		ForgotLimit:  ratelimit.New(5, 15*time.Minute).Middleware(),
	})
	users := v1.Group("/users", authRequired)
	h.Identity.RegisterUsers(users)
	h.Audit.RegisterUser(users)
	h.Notify.RegisterUser(users)

	// Unauthenticated integrations.
	public := v1.Group("/public")
	h.Work.RegisterPublic(public, ratelimit.New(30, time.Minute).Middleware())
	h.Share.RegisterPublic(public, ratelimit.New(120, time.Minute).Middleware())
	h.Calendar.RegisterPublic(public, ratelimit.New(60, time.Minute).Middleware())
	v1.POST("/livekit/webhook", h.Meet.Webhook)
	h.Work.RegisterInbound(v1, ratelimit.New(120, time.Minute).Middleware())
	// GitHub deliveries are verified with the workspace's webhook secret (HMAC).
	v1.POST("/integrations/github/webhook/:wid", h.Integrations.Webhook)

	// Realtime: browsers can't set headers on WebSockets, so the token rides in ?access_token.
	v1.GET("/ws", authRequired, h.Realtime.Connect)

	workspaces := v1.Group("/workspaces", authRequired)
	h.Workspace.RegisterCollection(workspaces)

	member := workspaces.Group("/:wid", wsmw.RequireMember(h.Workspaces), auditv1.Middleware(h.AuditLog, "/api/v1/workspaces/:wid"))
	h.Workspace.RegisterMember(member)
	member.GET("/online", h.Realtime.Online)
	h.Audit.Register(member)
	h.Calendar.Register(member)
	h.DocCollab.Register(member)

	content := member.Group("", wsmw.DenyGuests("POST /tasks/:id/comments"))
	h.Work.Register(content)
	h.Docs.Register(content)
	h.Goals.Register(content)
	h.Chat.Register(content)
	h.Notify.Register(member) // guests manage their own inbox
	h.Media.Register(content)
	h.Meet.Register(member) // guests can join calls
	h.Assistant.Register(content)
	h.Integrations.Register(content)
	h.Share.Register(content)
	h.Search.Register(member) // guests can search what they can see

	return r
}
