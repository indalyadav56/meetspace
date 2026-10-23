// Package redis builds a go-redis client from a small config and verifies the
// connection. It has no knowledge of this application.
package redis

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

type Config struct {
	Host         string
	Port         int
	Password     string
	DB           int
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	PoolSize     int
}

func New(ctx context.Context, cfg Config) (*goredis.Client, error) {
	if cfg.Port == 0 {
		cfg.Port = 6379
	}
	client := goredis.NewClient(&goredis.Options{
		Addr:         net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Password:     cfg.Password,
		DB:           cfg.DB,
		DialTimeout:  cfg.DialTimeout,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		PoolSize:     cfg.PoolSize,
	})
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return client, nil
}
