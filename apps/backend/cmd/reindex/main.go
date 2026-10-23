// Command reindex rebuilds the search index from the database, for data that
// existed before search was enabled or after the index was lost. Live changes
// are indexed by the worker.
//
//	reindex                 every workspace
//	reindex <workspace-id>  one workspace
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/internal/di"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "reindex:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	shared, err := di.NewShared(ctx, cfg, "meetspace-reindex")
	if err != nil {
		return err
	}
	defer shared.Close()
	cfg.AI.GeminiAPIKey = "" // not needed here
	c, err := di.NewServerContainer(ctx, shared)
	if err != nil {
		return err
	}
	if !c.Services.Search.Enabled() {
		return fmt.Errorf("search is not configured (opensearch.urls)")
	}
	ids := os.Args[1:]
	if len(ids) == 0 {
		if ids, err = c.Services.Workspaces.AllIDs(ctx); err != nil {
			return err
		}
	}
	start, total := time.Now(), 0
	for _, ws := range ids {
		items, err := c.WorkspaceItems(ctx, ws)
		if err != nil {
			return fmt.Errorf("workspace %s: %w", ws, err)
		}
		n, err := c.Services.Search.Reindex(ctx, ws, items)
		if err != nil {
			return fmt.Errorf("workspace %s: %w", ws, err)
		}
		total += n
		fmt.Printf("indexed %d items in workspace %s\n", n, ws)
	}
	fmt.Printf("done: %d items across %d workspaces in %s\n", total, len(ids), time.Since(start).Round(time.Millisecond))
	return nil
}
