package mailer

import (
	"context"
	"errors"
	"fmt"
	"net/mail"

	"github.com/resend/resend-go/v4"
)

// Resend sends email through the Resend HTTP API (https://resend.com/docs).
// Only an API key with sending access is needed.
type Resend struct {
	client *resend.Client
	from   string
}

func NewResend(apiKey, from string) (*Resend, error) {
	if apiKey == "" {
		return nil, errors.New("mailer: resend api key is required")
	}
	if _, err := mail.ParseAddress(from); err != nil {
		return nil, fmt.Errorf("mailer: invalid from address %q: %w", from, err)
	}
	return &Resend{client: resend.NewClient(apiKey), from: from}, nil
}

func (r *Resend) Send(ctx context.Context, m Message) error {
	_, err := r.client.Emails.SendWithContext(ctx, &resend.SendEmailRequest{
		From:    r.from,
		To:      []string{m.To},
		Subject: m.Subject,
		Text:    m.Text,
		Html:    m.HTML,
	})
	if err != nil {
		return fmt.Errorf("mailer: resend: %w", err)
	}
	return nil
}
