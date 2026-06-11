// Package httpserver wraps net/http.Server with graceful shutdown.
// It takes any http.Handler and knows nothing about the application.
package httpserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
)

type Server struct {
	cfg        Config
	httpServer *http.Server
	listener   net.Listener
	log        *slog.Logger

	mu      sync.Mutex
	started bool
}

func New(cfg Config, handler http.Handler, log *slog.Logger) *Server {
	if log == nil {
		log = slog.Default()
	}
	return &Server{
		cfg: cfg,
		log: log,
		httpServer: &http.Server{
			Addr:              cfg.Address(),
			Handler:           handler,
			ReadTimeout:       cfg.ReadTimeout,
			WriteTimeout:      cfg.WriteTimeout,
			IdleTimeout:       cfg.IdleTimeout,
			ReadHeaderTimeout: cfg.ReadHeaderTimeout,
			MaxHeaderBytes:    cfg.MaxHeaderBytes,
		},
	}
}

// Run blocks until ctx is cancelled or the server fails.
func (s *Server) Run(ctx context.Context) error {
	s.mu.Lock()
	if s.started {
		s.mu.Unlock()
		return errors.New("server already started")
	}
	s.started = true

	listener, err := net.Listen("tcp", s.cfg.Address())
	if err != nil {
		s.mu.Unlock()
		return fmt.Errorf("listen on %s: %w", s.cfg.Address(), err)
	}
	s.listener = listener
	s.mu.Unlock()

	serverErr := make(chan error, 1)
	go func() {
		s.log.Info("http server listening", "addr", listener.Addr().String())
		if err := s.httpServer.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
			return
		}
		serverErr <- nil
	}()

	select {
	case err := <-serverErr:
		if err != nil {
			return fmt.Errorf("server error: %w", err)
		}
		return nil
	case <-ctx.Done():
		s.log.Info("shutdown signal received, draining connections")
		return s.shutdown()
	}
}

func (s *Server) shutdown() error {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), s.cfg.ShutdownTimeout)
	defer cancel()

	if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
		s.log.Error("graceful shutdown failed, forcing close", "error", err)
		if closeErr := s.httpServer.Close(); closeErr != nil {
			s.log.Error("force close failed", "error", closeErr)
		}
		return fmt.Errorf("shutdown: %w", err)
	}
	s.log.Info("server stopped cleanly")
	return nil
}
