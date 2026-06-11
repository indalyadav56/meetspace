// Command migrator applies SQL migrations from the migrations/ directory in
// filename order, tracking applied versions in schema_migrations.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/pkg/logger"
	pgpkg "github.com/indalyadav56/meetspace/backend/pkg/postgres"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	dir := "migrations"
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logger.New(cfg.LogLevel)
	ctx := context.Background()

	db, err := pgpkg.New(ctx, cfg.Postgres)
	if err != nil {
		return err
	}
	defer db.Close()

	if _, err := db.ExecContext(ctx,
		`CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("ensure schema_migrations: %w", err)
	}

	var current int
	if err := db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&current); err != nil {
		return err
	}

	entries, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil {
		return err
	}
	sort.Strings(entries)

	applied := 0
	for _, path := range entries {
		base := filepath.Base(path)
		numStr, _, ok := strings.Cut(base, "_")
		if !ok {
			return fmt.Errorf("migration %s: name must be NNNN_description.up.sql", base)
		}
		version, err := strconv.Atoi(numStr)
		if err != nil {
			return fmt.Errorf("migration %s: bad version prefix: %w", base, err)
		}
		if version <= current {
			continue
		}

		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(sqlBytes)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply %s: %w", base, err)
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			tx.Rollback()
			return fmt.Errorf("record %s: %w", base, err)
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		log.Info("applied migration", "file", base)
		applied++
	}

	log.Info("migrations complete", "applied", applied, "current", current+applied)
	return nil
}
