// Package webpush sends browser push notifications with VAPID (RFC 8292) and
// aes128gcm payload encryption (RFC 8291).
package webpush

import (
	"context"
	"fmt"
	"io"
	"net/http"

	wp "github.com/SherClockHolmes/webpush-go"

	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
)

// Keys loads (or first creates) the server's VAPID key pair.
type Keys interface {
	VAPID(ctx context.Context, generate func() (pub, priv string, err error)) (pub, priv string, err error)
}

type Sender struct {
	keys    Keys
	subject string
}

// New uses subject (a mailto: or https: URL) to identify the sender to push services.
func New(keys Keys, subject string) *Sender { return &Sender{keys: keys, subject: subject} }

func generate() (string, string, error) {
	priv, pub, err := wp.GenerateVAPIDKeys()
	return pub, priv, err
}

func (s *Sender) PublicKey(ctx context.Context) (string, error) {
	pub, _, err := s.keys.VAPID(ctx, generate)
	return pub, err
}

func (s *Sender) Send(ctx context.Context, sub domain.PushSubscription, payload []byte) (bool, error) {
	pub, priv, err := s.keys.VAPID(ctx, generate)
	if err != nil {
		return false, err
	}
	res, err := wp.SendNotificationWithContext(ctx, payload, &wp.Subscription{Endpoint: sub.Endpoint, Keys: wp.Keys{P256dh: sub.P256dh, Auth: sub.Auth}}, &wp.Options{
		Subscriber: s.subject, VAPIDPublicKey: pub, VAPIDPrivateKey: priv, TTL: 3600, Urgency: wp.UrgencyHigh,
	})
	if err != nil {
		return false, err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 4096))
	switch {
	case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone:
		return true, nil
	case res.StatusCode >= 300:
		return false, fmt.Errorf("push service answered %s", res.Status)
	}
	return false, nil
}
