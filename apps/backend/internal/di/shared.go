package di

import (
	"context"
	"database/sql"
	"fmt"

	goredis "github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/pkg/logger"
	"github.com/indalyadav56/meetspace/backend/pkg/postgres"
	"github.com/indalyadav56/meetspace/backend/pkg/redis"
)

// Shared holds the infrastructure every binary needs. Each binary builds its
// own container on top of it, so a worker never constructs HTTP handlers.
type Shared struct {
	Cfg   *config.Config
	Log   *zap.Logger
	DB    *sql.DB
	Redis *goredis.Client
}

// NewShared connects to Postgres and Redis. Close releases them.
func NewShared(ctx context.Context, cfg *config.Config, service string) (*Shared, error) {
	logCfg := cfg.Logger
	logCfg.Service = service
	logCfg.Environment = cfg.AppEnv
	log := logger.New(logCfg)

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
		return nil, fmt.Errorf("postgres: %w", err)
	}

	rdb, err := redis.New(ctx, redis.Config{
		Host: cfg.Redis.Host, Port: cfg.Redis.Port, Password: cfg.Redis.Password, DB: cfg.Redis.DB,
		DialTimeout: cfg.Redis.DialTimeout, ReadTimeout: cfg.Redis.ReadTimeout, WriteTimeout: cfg.Redis.WriteTimeout,
		PoolSize: cfg.Redis.PoolSize,
	})
	if err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("redis: %w", err)
	}
	return &Shared{Cfg: cfg, Log: log, DB: db, Redis: rdb}, nil
}

// Ready reports whether the backing stores answer.
func (s *Shared) Ready(ctx context.Context) error {
	if err := s.DB.PingContext(ctx); err != nil {
		return fmt.Errorf("postgres: %w", err)
	}
	if err := s.Redis.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis: %w", err)
	}
	return nil
}

func (s *Shared) Close() {
	_ = s.Redis.Close()
	_ = s.DB.Close()
	_ = s.Log.Sync()
}
