// Command worker runs Meetspace background jobs: it fires due reminders into
// the inbox and keeps the search index up to date from the realtime event bus.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/internal/di"
)

const reminderInterval = 15 * time.Second

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

	shared, err := di.NewShared(ctx, cfg, "meetspace-worker")
	if err != nil {
		return err
	}
	defer shared.Close()
	c, err := di.NewWorkerContainer(ctx, shared)
	if err != nil {
		return err
	}

	if c.Search.Enabled() {
		go indexChanges(ctx, c)
	}

	c.Log.Info("worker started", zap.Duration("reminder_interval", reminderInterval), zap.Bool("search_indexing", c.Search.Enabled()))
	t := time.NewTicker(reminderInterval)
	defer t.Stop()
	var lastPurge time.Time
	for {
		// Audit events older than the retention window are dropped once a day.
		if time.Since(lastPurge) > 24*time.Hour {
			if n, err := c.Audit.Purge(ctx); err != nil && ctx.Err() == nil {
				c.Log.Warn("purging audit log failed", zap.Error(err))
			} else if n > 0 {
				c.Log.Info("purged old audit events", zap.Int64("count", n))
			}
			lastPurge = time.Now()
		}
		// Email and browser push for notifications that are still unread.
		if p, e, d, err := c.Delivery.Tick(ctx); err != nil && ctx.Err() == nil {
			c.Log.Warn("notification delivery failed", zap.Error(err))
		} else if p+e+d > 0 {
			c.Log.Info("delivered notifications", zap.Int("pushed", p), zap.Int("emailed", e), zap.Int("digests", d))
		}
		n, err := c.Notify.FireDue(ctx)
		if err != nil && ctx.Err() == nil {
			c.Log.Error("firing reminders failed", zap.Error(err))
		} else if n > 0 {
			c.Log.Info("fired reminders", zap.Int("count", n))
		}
		select {
		case <-ctx.Done():
			c.Log.Info("worker stopped")
			return nil
		case <-t.C:
		}
	}
}

// indexChanges feeds every change published on the bus into the search index,
// resubscribing with backoff if the connection to Redis drops.
func indexChanges(ctx context.Context, c *di.WorkerContainer) {
	backoff := time.Second
	for ctx.Err() == nil {
		err := c.Bus.Subscribe(ctx, func(_ string, data []byte) { c.Search.ApplyEvent(ctx, data) })
		if ctx.Err() != nil {
			return
		}
		c.Log.Warn("search indexer disconnected; retrying", zap.Error(err), zap.Duration("in", backoff))
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, 30*time.Second)
	}
}
