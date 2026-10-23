// Package email contains EmailSender adapters.
package email

import (
	"context"

	"go.uber.org/zap"
)

// LogSender writes emails to the log instead of sending them. Swap in an SMTP
// or provider-backed sender for production.
type LogSender struct {
	log    *zap.Logger
	webURL string
}

func NewLogSender(log *zap.Logger, webURL string) *LogSender {
	return &LogSender{log: log, webURL: webURL}
}

func (s *LogSender) SendPasswordReset(_ context.Context, to, rawToken string) error {
	s.log.Info("password reset email", zap.String("to", to), zap.String("link", s.webURL+"/reset-password?token="+rawToken))
	return nil
}
