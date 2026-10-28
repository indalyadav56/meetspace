package application

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

const (
	// pushDelay gives the in-app toast a moment first; read notifications aren't pushed.
	pushDelay = 20 * time.Second
	// emailDelay skips the email when someone reads the notification in the app first.
	emailDelay = 3 * time.Minute
)

// Pusher sends one encrypted Web Push message. gone means the browser
// unsubscribed and the subscription should be forgotten.
type Pusher interface {
	PublicKey(ctx context.Context) (string, error)
	Send(ctx context.Context, sub domain.PushSubscription, payload []byte) (gone bool, err error)
}

// Mailer renders and sends notification emails.
type Mailer interface {
	SendNotifications(ctx context.Context, to, name string, items []domain.Outgoing, due []domain.DueTask, digest bool) error
}

// Delivery sends notifications by email and browser push from the worker.
type Delivery struct {
	repo   domain.DeliveryRepository
	push   Pusher
	mail   Mailer
	webURL string
	log    *zap.Logger
	now    func() time.Time
}

func NewDelivery(repo domain.DeliveryRepository, push Pusher, mail Mailer, webURL string, log *zap.Logger) *Delivery {
	return &Delivery{repo: repo, push: push, mail: mail, webURL: strings.TrimRight(webURL, "/"), log: log, now: time.Now}
}

var kinds = []string{"mention", "assigned", "comment", "status", "due", "reminder", "timesheet"}

func (d *Delivery) Preferences(ctx context.Context, userID string) (domain.Preferences, error) {
	return d.repo.Preferences(ctx, userID)
}

func (d *Delivery) SavePreferences(ctx context.Context, userID string, p domain.Preferences) (domain.Preferences, error) {
	if !slices.Contains([]string{"instant", "digest", "off"}, p.EmailMode) {
		return p, apperror.Invalid("invalid_email_mode", "email must be instant, digest or off")
	}
	if p.DigestHour < 0 || p.DigestHour > 23 || p.QuietStart < -1 || p.QuietStart > 23 || p.QuietEnd < -1 || p.QuietEnd > 23 {
		return p, apperror.Invalid("invalid_hour", "hours must be between 0 and 23")
	}
	if _, err := time.LoadLocation(p.Timezone); err != nil || p.Timezone == "" {
		return p, apperror.Invalid("invalid_timezone", "unknown timezone")
	}
	clean := func(in []string) []string {
		out := []string{}
		for _, k := range in {
			if slices.Contains(kinds, k) && !slices.Contains(out, k) {
				out = append(out, k)
			}
		}
		return out
	}
	p.EmailKinds, p.PushKinds = clean(p.EmailKinds), clean(p.PushKinds)
	return p, d.repo.SavePreferences(ctx, userID, p)
}

func (d *Delivery) PublicKey(ctx context.Context) (string, error) { return d.push.PublicKey(ctx) }

func (d *Delivery) Subscribe(ctx context.Context, s domain.PushSubscription) error {
	if !strings.HasPrefix(s.Endpoint, "https://") || s.P256dh == "" || s.Auth == "" {
		return apperror.Invalid("invalid_subscription", "that push subscription isn't valid")
	}
	return d.repo.SaveSubscription(ctx, s)
}

func (d *Delivery) Unsubscribe(ctx context.Context, userID, endpoint string) error {
	return d.repo.DeleteSubscription(ctx, userID, endpoint)
}

func (d *Delivery) Subscriptions(ctx context.Context, userID string) ([]domain.PushSubscription, error) {
	return d.repo.Subscriptions(ctx, userID)
}

// Test pushes a sample notification to every browser the person enabled.
func (d *Delivery) Test(ctx context.Context, userID string) (int, error) {
	subs, err := d.repo.Subscriptions(ctx, userID)
	if err != nil {
		return 0, err
	}
	if len(subs) == 0 {
		return 0, apperror.Invalid("no_push", "turn on push notifications in this browser first")
	}
	payload, _ := json.Marshal(map[string]string{"title": "Meetspace", "body": "Push notifications are working 🎉", "url": d.webURL + "/app/notifications", "tag": "test"})
	return d.sendAll(ctx, subs, payload), nil
}

func (d *Delivery) sendAll(ctx context.Context, subs []domain.PushSubscription, payload []byte) int {
	sent := 0
	for _, s := range subs {
		gone, err := d.push.Send(ctx, s, payload)
		switch {
		case gone:
			_ = d.repo.DeleteSubscription(ctx, "", s.Endpoint)
		case err != nil:
			d.log.Warn("push failed", zap.Error(err))
		default:
			sent++
			_ = d.repo.TouchSubscription(ctx, s.ID)
		}
	}
	return sent
}

// localHour is the hour of t in tz (UTC if tz is unknown).
func localHour(t time.Time, tz string) int {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	return t.In(loc).Hour()
}

// quiet reports whether hour falls in [start, end), wrapping past midnight.
func quiet(hour, start, end int) bool {
	if start < 0 || end < 0 || start == end {
		return false
	}
	if start < end {
		return hour >= start && hour < end
	}
	return hour >= start || hour < end
}

func (d *Delivery) link(o domain.Outgoing) string {
	if o.TaskID != "" && o.TaskTitle != "" {
		return d.webURL + "/app/t/" + o.TaskID
	}
	if o.Kind == "timesheet" {
		return d.webURL + "/app/timesheets"
	}
	return d.webURL + "/app/notifications"
}

// Line is "Priya Shah assigned you", without doubling a name the text already starts with.
func Line(o domain.Outgoing) string {
	if o.ActorName == "" || strings.HasPrefix(o.Text, o.ActorName) {
		return o.Text
	}
	return o.ActorName + " " + o.Text
}

// Tick runs one round of delivery; the worker calls it every few seconds.
func (d *Delivery) Tick(ctx context.Context) (pushed, emailed, digests int, err error) {
	now := d.now()

	// Browser push.
	batch, err := d.repo.ClaimPush(ctx, now.Add(-pushDelay), 200)
	if err != nil {
		return 0, 0, 0, err
	}
	subsCache := map[string][]domain.PushSubscription{}
	for _, o := range batch {
		p := o.Prefs
		if o.Read || o.Cleared || !p.PushEnabled || !slices.Contains(p.PushKinds, o.Kind) ||
			(p.PausedUntil != nil && p.PausedUntil.After(now)) || quiet(localHour(now, p.Timezone), p.QuietStart, p.QuietEnd) {
			continue
		}
		subs, ok := subsCache[o.UserID]
		if !ok {
			if subs, err = d.repo.Subscriptions(ctx, o.UserID); err != nil {
				return pushed, 0, 0, err
			}
			subsCache[o.UserID] = subs
		}
		if len(subs) == 0 {
			continue
		}
		title := o.TaskTitle
		if title == "" {
			title = o.WorkspaceName
		}
		payload, _ := json.Marshal(map[string]string{"title": title, "body": Line(o), "url": d.link(o), "tag": o.ID})
		pushed += d.sendAll(ctx, subs, payload)
	}

	// Instant email, one message per person per round.
	batch, err = d.repo.ClaimInstantEmail(ctx, now.Add(-emailDelay), 200)
	if err != nil {
		return pushed, 0, 0, err
	}
	byUser := map[string][]domain.Outgoing{}
	var order []string
	for _, o := range batch {
		if !slices.Contains(o.Prefs.EmailKinds, o.Kind) {
			continue
		}
		if _, ok := byUser[o.UserID]; !ok {
			order = append(order, o.UserID)
		}
		byUser[o.UserID] = append(byUser[o.UserID], o)
	}
	for _, uid := range order {
		items := byUser[uid]
		if err := d.mail.SendNotifications(ctx, items[0].RecipientMail, items[0].RecipientName, items, nil, false); err != nil {
			d.log.Warn("notification email failed", zap.Error(err))
			continue
		}
		emailed++
	}

	// Daily digest at each person's chosen local hour.
	users, err := d.repo.DigestRecipients(ctx, now)
	if err != nil {
		return pushed, emailed, 0, err
	}
	for _, uid := range users {
		items, err := d.repo.ClaimDigest(ctx, uid, now)
		if err != nil {
			return pushed, emailed, digests, err
		}
		var keep []domain.Outgoing
		for _, o := range items {
			if slices.Contains(o.Prefs.EmailKinds, o.Kind) {
				keep = append(keep, o)
			}
		}
		if len(keep) == 0 {
			continue
		}
		loc, lerr := time.LoadLocation(keep[0].Prefs.Timezone)
		if lerr != nil {
			loc = time.UTC
		}
		due, _ := d.repo.DueTasks(ctx, uid, now.In(loc).Format("2006-01-02"))
		if err := d.mail.SendNotifications(ctx, keep[0].RecipientMail, keep[0].RecipientName, keep, due, true); err != nil {
			d.log.Warn("digest email failed", zap.Error(err))
			continue
		}
		digests++
	}
	return pushed, emailed, digests, nil
}
