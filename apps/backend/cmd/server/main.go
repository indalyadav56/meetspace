// Command server runs the meetspace HTTP API.

//	@title			Meetspace API
//	@version		1.0
//	@description	Meetspace backend REST API.
//	@termsOfService	http://swagger.io/terms/

//	@contact.name	Meetspace Support
//	@contact.email	indalkumar56@gmail.com

//	@license.name	MIT

//	@host		localhost:8080
//	@BasePath	/api/v1

//	@securityDefinitions.apikey	BearerAuth
//	@in							header
//	@name						Authorization
//	@description				Type "Bearer" followed by a space and the JWT token.

package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/internal/di"
	"github.com/indalyadav56/meetspace/backend/internal/server"
	"github.com/indalyadav56/meetspace/backend/pkg/httpserver"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	shared, err := di.NewShared(ctx, cfg, "meetspace-server")
	if err != nil {
		return err
	}
	defer shared.Close()

	c, err := di.NewServerContainer(ctx, shared)
	if err != nil {
		return err
	}

	isProd := strings.EqualFold(cfg.AppEnv, "prod") || strings.EqualFold(cfg.AppEnv, "production")
	router := server.NewRouter(server.Options{
		Handlers:       c.Handlers,
		Log:            c.Log,
		AllowedOrigins: cfg.Web.AllowedOrigins,
		Ready:          c.Ready,
		ReleaseMode:    isProd,
	})

	httpCfg := httpserver.DefaultConfig()
	if p, err := strconv.Atoi(strings.TrimSpace(cfg.Server.Port)); err == nil && p > 0 {
		httpCfg.Port = p
	}
	if cfg.Server.ReadTimeout > 0 {
		httpCfg.ReadTimeout = cfg.Server.ReadTimeout
	}
	// Streaming endpoints (WebSocket, assistant SSE, media) must not be cut off
	// by a write deadline, so 0 (no timeout) is honoured here.
	httpCfg.WriteTimeout = cfg.Server.WriteTimeout
	if cfg.Server.IdleTimeout > 0 {
		httpCfg.IdleTimeout = cfg.Server.IdleTimeout
	}

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		err := c.Hub.Run(gctx)
		if errors.Is(err, context.Canceled) {
			return nil
		}
		return err
	})
	// GitHub: link pull requests and commits that mention MS-123 even without a
	// public webhook URL. Upserts are idempotent, so extra replicas are harmless.
	g.Go(func() error { return c.Services.Integrations.RunSync(gctx, 10*time.Minute) })
	for _, job := range c.Jobs {
		g.Go(func() error { job(gctx); return nil })
	}
	g.Go(func() error {
		c.Log.Info("starting meetspace server", zap.String("env", cfg.AppEnv), zap.Int("port", httpCfg.Port))
		return httpserver.New(httpCfg, router, nil).Run(gctx)
	})
	return g.Wait()
}
