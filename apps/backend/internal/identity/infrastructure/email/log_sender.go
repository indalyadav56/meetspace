// Package email contains EmailSender adapters.
package email

import (
	"context"

	"go.uber.org/zap"
)

// LogSender writes emails to the log instead of sending them. It is used when
// no email provider is configured (local development).
type LogSender struct {
	log  *zap.Logger
	urls links
}

func NewLogSender(log *zap.Logger, webURL string) *LogSender {
	return &LogSender{log: log, urls: links{webURL}}
}

func (s *LogSender) SendPasswordReset(_ context.Context, to, rawToken string) error {
	s.log.Info("password reset email (not sent: no email provider configured)", zap.String("to", to), zap.String("link", s.urls.reset(rawToken)))
	return nil
}

func (s *LogSender) SendWorkspaceInvite(_ context.Context, to, inviter, workspace, rawToken string) error {
	link := s.urls.login()
	if rawToken != "" {
		link = s.urls.setPassword(rawToken)
	}
	s.log.Info("invite email (not sent: no email provider configured)", zap.String("to", to), zap.String("workspace", workspace), zap.String("inviter", inviter), zap.String("link", link))
	return nil
}
