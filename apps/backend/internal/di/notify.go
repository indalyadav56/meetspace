package di

import (
	"cmp"
	"context"
	"strings"

	"go.uber.org/zap"

	notifyapp "github.com/indalyadav56/meetspace/backend/internal/notify/application"
	notifyemail "github.com/indalyadav56/meetspace/backend/internal/notify/infrastructure/email"
	notifypg "github.com/indalyadav56/meetspace/backend/internal/notify/infrastructure/postgres"
	"github.com/indalyadav56/meetspace/backend/internal/notify/infrastructure/webpush"
	"github.com/indalyadav56/meetspace/backend/pkg/mailer"
)

// logMailer stands in when no email provider is configured: it records that a
// message would have gone out, without its contents.
type logMailer struct{ log *zap.Logger }

func (m logMailer) Send(_ context.Context, msg mailer.Message) error {
	m.log.Info("email not sent (no provider configured)", zap.String("subject", msg.Subject))
	return nil
}

// newMailer picks Resend, then SMTP, then the log stand-in.
func newMailer(sh *Shared) (notifyemail.Mailer, error) {
	cfg := sh.Cfg
	switch {
	case cfg.Resend.APIKey != "":
		return mailer.NewResend(cfg.Resend.APIKey, cmp.Or(cfg.Resend.From, defaultFrom))
	case cfg.SMTP.Host != "" && cfg.SMTP.Password != "":
		c := cfg.SMTP
		return mailer.New(mailer.Config{Host: c.Host, Port: c.Port, Username: c.User, Password: c.Password, From: cmp.Or(c.From, defaultFrom)})
	}
	return logMailer{sh.Log}, nil
}

// newDelivery wires email and browser-push delivery of notifications.
func newDelivery(sh *Shared) (*notifyapp.Delivery, error) {
	m, err := newMailer(sh)
	if err != nil {
		return nil, err
	}
	repo := notifypg.NewDelivery(sh.DB)
	web := sh.Cfg.Web.URL
	// Push services want a contact for the sender: the site when it's public, else a mailbox.
	subject := "mailto:notifications@meetspace.dev"
	if strings.HasPrefix(web, "https://") {
		subject = web
	}
	return notifyapp.NewDelivery(repo, webpush.New(repo, subject), notifyemail.NewSender(m, web), web, sh.Log), nil
}
