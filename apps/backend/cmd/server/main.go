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

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/internal/handler"
	"github.com/indalyadav56/meetspace/backend/internal/repository"
	"github.com/indalyadav56/meetspace/backend/internal/server"
	"github.com/indalyadav56/meetspace/backend/internal/service"
	"github.com/indalyadav56/meetspace/backend/pkg/httpserver"
	"github.com/indalyadav56/meetspace/backend/pkg/jwt"
	"github.com/indalyadav56/meetspace/backend/pkg/logger"
	"github.com/indalyadav56/meetspace/backend/pkg/password"
	"github.com/indalyadav56/meetspace/backend/pkg/postgres"
	"github.com/indalyadav56/meetspace/backend/pkg/ratelimit"
)

const (
	defaultAccessTTL  = 15 * time.Minute
	defaultRefreshTTL = 30 * 24 * time.Hour
	defaultResetTTL   = time.Hour
	defaultPort       = 8080

	loginRateLimit   = 10
	loginRateWindow  = time.Minute
	forgotRateLimit  = 5
	forgotRateWindow = 15 * time.Minute
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

	if strings.TrimSpace(cfg.JWT.Secret) == "" {
		return errors.New("jwt.secret is required (set APP_JWT_SECRET or jwt.secret in your config)")
	}

	logCfg := cfg.Logger
	logCfg.Service = "meetspace-backend"
	logCfg.Environment = cfg.AppEnv
	log := logger.New(logCfg)
	defer func() { _ = log.Sync() }()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Database
	pgCfg := postgres.DefaultConfig()
	pgCfg.URL = cfg.Postgres.DSN()
	if cfg.Postgres.MaxOpenConns > 0 {
		pgCfg.MaxOpenConns = cfg.Postgres.MaxOpenConns
	}
	if cfg.Postgres.MaxIdleConns > 0 {
		pgCfg.MaxIdleConns = cfg.Postgres.MaxIdleConns
	}
	if cfg.Postgres.ConnMaxLifetime > 0 {
		pgCfg.ConnMaxLifetime = cfg.Postgres.ConnMaxLifetime
	}
	db, err := postgres.New(ctx, pgCfg)
	if err != nil {
		return err
	}
	defer db.Close()

	// Token lifetimes
	accessTTL := cfg.JWT.AccessTokenTTL
	if accessTTL <= 0 {
		accessTTL = defaultAccessTTL
	}
	refreshTTL := cfg.JWT.RefreshTokenTTL
	if refreshTTL <= 0 {
		refreshTTL = defaultRefreshTTL
	}

	signer := jwt.New(jwt.JWTConfig{
		SecretKey:     []byte(cfg.JWT.Secret),
		TokenDuration: accessTTL,
		Issuer:        cfg.JWT.Issuer,
	})

	// Repositories
	userRepo := repository.NewUserRepository(db)
	refreshRepo := repository.NewRefreshTokenRepository(db)
	resetRepo := repository.NewPasswordResetTokenRepository(db)

	// Services
	hasher := password.NewDefaultBcryptHasher()
	emailer := service.NewLogEmailSender(log)
	authSvc := service.NewAuthService(userRepo, refreshRepo, resetRepo, hasher, signer, emailer, service.AuthConfig{
		AccessTTL:  accessTTL,
		RefreshTTL: refreshTTL,
		ResetTTL:   defaultResetTTL,
	}, nil)
	userSvc := service.NewUserService(userRepo)

	// Handlers
	isProd := strings.EqualFold(cfg.AppEnv, "prod") || strings.EqualFold(cfg.AppEnv, "production")
	authHandler := handler.NewAuthHandler(authSvc, !isProd)
	userHandler := handler.NewUserHandler(userSvc)

	// Router
	router := server.NewRouter(server.Options{
		Logger:        log,
		Signer:        signer,
		Auth:          authHandler,
		User:          userHandler,
		LoginLimiter:  ratelimit.New(loginRateLimit, loginRateWindow),
		ForgotLimiter: ratelimit.New(forgotRateLimit, forgotRateWindow),
		ReleaseMode:   isProd,
	})

	// HTTP server
	port := defaultPort
	if p, err := strconv.Atoi(strings.TrimSpace(cfg.Server.Port)); err == nil && p > 0 {
		port = p
	}
	httpCfg := httpserver.DefaultConfig()
	httpCfg.Port = port
	if cfg.Server.ReadTimeout > 0 {
		httpCfg.ReadTimeout = cfg.Server.ReadTimeout
	}
	if cfg.Server.WriteTimeout > 0 {
		httpCfg.WriteTimeout = cfg.Server.WriteTimeout
	}
	if cfg.Server.IdleTimeout > 0 {
		httpCfg.IdleTimeout = cfg.Server.IdleTimeout
	}

	srv := httpserver.New(httpCfg, router, nil)
	log.Info("starting meetspace backend", zap.String("env", cfg.AppEnv), zap.Int("port", port))
	return srv.Run(ctx)
}
