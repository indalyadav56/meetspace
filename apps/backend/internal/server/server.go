package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.uber.org/zap"

	_ "github.com/indalyadav56/meetspace/backend/docs/swagger" // generated swagger docs
	"github.com/indalyadav56/meetspace/backend/internal/handler"
	"github.com/indalyadav56/meetspace/backend/internal/middleware"
	"github.com/indalyadav56/meetspace/backend/pkg/jwt"
	"github.com/indalyadav56/meetspace/backend/pkg/logger"
	"github.com/indalyadav56/meetspace/backend/pkg/ratelimit"
)

type Options struct {
	Logger        *zap.Logger
	Signer        *jwt.JWT
	Auth          *handler.AuthHandler
	User          *handler.UserHandler
	LoginLimiter  *ratelimit.Limiter
	ForgotLimiter *ratelimit.Limiter
	ReleaseMode   bool
}

// NewRouter assembles the gin engine, middleware stack, and routes.
func NewRouter(opts Options) *gin.Engine {
	if opts.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	if opts.Logger != nil {
		r.Use(logger.LoggerMiddleware(opts.Logger))
	}

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	authRequired := middleware.AuthRequired(opts.Signer)

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", opts.Auth.Register)
			auth.POST("/login", middleware.RateLimit(opts.LoginLimiter), opts.Auth.Login)
			auth.POST("/refresh", opts.Auth.Refresh)
			auth.POST("/forgot-password", middleware.RateLimit(opts.ForgotLimiter), opts.Auth.ForgotPassword)
			auth.POST("/reset-password", opts.Auth.ResetPassword)

			authed := auth.Group("")
			authed.Use(authRequired)
			authed.POST("/logout", opts.Auth.Logout)
			authed.POST("/change-password", opts.Auth.ChangePassword)
		}

		users := v1.Group("/users")
		users.Use(authRequired)
		{
			users.GET("/me", opts.User.Me)
			users.PATCH("/me", opts.User.UpdateMe)
		}
	}

	return r
}
