package service

import (
	"context"

	"go.uber.org/zap"
)

// EmailSender delivers transactional emails. It is the seam for plugging in a
// real provider (SMTP, SES, etc.); the password reset flow depends only on this
// interface.
type EmailSender interface {
	// SendPasswordReset delivers a reset token to the given address.
	SendPasswordReset(ctx context.Context, to, resetToken string) error
}

// LogEmailSender "sends" email by logging it. It lets the reset flow work
// end-to-end before a real provider is wired up. It never logs the raw token at
// info level to avoid leaking it into shared logs.
type LogEmailSender struct {
	log *zap.Logger
}

// NewLogEmailSender returns an EmailSender that logs instead of sending.
func NewLogEmailSender(log *zap.Logger) *LogEmailSender {
	return &LogEmailSender{log: log}
}

// SendPasswordReset implements EmailSender.
func (s *LogEmailSender) SendPasswordReset(_ context.Context, to, resetToken string) error {
	if s.log != nil {
		s.log.Info("password reset requested (email delivery not configured)", zap.String("to", to))
		s.log.Debug("password reset token", zap.String("to", to), zap.String("token", resetToken))
	}
	return nil
}
