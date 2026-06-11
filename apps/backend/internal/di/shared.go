// Package di holds the composition root: per-binary containers that wire
// bounded contexts together. This is the ONLY package that imports multiple
// bounded contexts.
package di

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	pgpkg "github.com/indalyadav56/meetspace/backend/pkg/postgres"
)

// Shared holds infrastructure every binary needs.
type Shared struct {
	Config *config.Config
	Logger *slog.Logger
	DB     *sql.DB
}

func NewShared(ctx context.Context, cfg *config.Config, log *slog.Logger) (*Shared, error) {
	db, err := pgpkg.New(ctx, cfg.Postgres)
	if err != nil {
		return nil, fmt.Errorf("postgres: %w", err)
	}
	return &Shared{Config: cfg, Logger: log, DB: db}, nil
}

func (s *Shared) Close() error {
	var errs []error
	if s.DB != nil {
		errs = append(errs, s.DB.Close())
	}
	return errors.Join(errs...)
}
