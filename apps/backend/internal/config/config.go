// Package config defines the typed application config, loaded from env vars.
package config

import (
	"os"
	"strconv"

	"github.com/indalyadav56/meetspace/backend/pkg/httpserver"
	"github.com/indalyadav56/meetspace/backend/pkg/postgres"
)

type Config struct {
	Env      string
	LogLevel string
	Server   httpserver.Config
	Postgres postgres.Config
}

// Load reads configuration from environment variables with local-dev defaults.
func Load() (*Config, error) {
	cfg := &Config{
		Env:      getenv("APP_ENV", "development"),
		LogLevel: getenv("LOG_LEVEL", "info"),
		Server:   httpserver.DefaultConfig(),
		Postgres: postgres.DefaultConfig(),
	}
	cfg.Server.Port = getenvInt("PORT", 8080)
	cfg.Postgres.URL = getenv("DATABASE_URL",
		"postgres://meetspace:meetspace@localhost:5434/meetspace?sslmode=disable")
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
