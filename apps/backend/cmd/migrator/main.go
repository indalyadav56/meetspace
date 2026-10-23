// Command migrator applies database migrations.
//
//	migrator [up|down|status|reset]   (default: up)
//
// After the SQL migrations it lets Google ADK create or update its session
// tables in the assistant schema, as ADK requires on every release.
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/pressly/goose/v3"
	adkdb "google.golang.org/adk/session/database"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/internal/di"
	"github.com/indalyadav56/meetspace/backend/pkg/postgres"
)

const dir = "migrations"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "migrator:", err)
		os.Exit(1)
	}
}

func run() error {
	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pg := postgres.DefaultConfig()
	pg.URL = cfg.Postgres.DSN()
	db, err := postgres.New(ctx, pg)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	switch cmd {
	case "up":
		if err := goose.UpContext(ctx, db, dir); err != nil {
			return err
		}
	case "down":
		return goose.DownContext(ctx, db, dir)
	case "reset":
		return goose.ResetContext(ctx, db, dir)
	case "status":
		return goose.StatusContext(ctx, db, dir)
	default:
		return fmt.Errorf("unknown command %q (want up, down, status or reset)", cmd)
	}

	sessions, err := di.NewAssistantSessions(cfg.Postgres.DSN())
	if err != nil {
		return err
	}
	if err := adkdb.AutoMigrate(sessions); err != nil {
		return fmt.Errorf("assistant sessions: %w", err)
	}
	fmt.Println("migrations applied")
	return nil
}
