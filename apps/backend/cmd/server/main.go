// Command server runs the meetspace HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/internal/di"
	"github.com/indalyadav56/meetspace/backend/internal/server"
	"github.com/indalyadav56/meetspace/backend/pkg/httpserver"
	"github.com/indalyadav56/meetspace/backend/pkg/logger"
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
	log := logger.New(cfg.LogLevel)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	container, err := di.NewServerContainer(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer container.Close()

	handler := server.NewRouter(container)
	srv := httpserver.New(cfg.Server, handler, log)

	if err := srv.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		return err
	}
	return nil
}
