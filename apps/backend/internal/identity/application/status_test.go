package application

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
)

func TestSetStatus(t *testing.T) {
	ctx := context.Background()
	users := &memUsers{byID: map[string]*domain.User{"u1": {ID: "u1", FullName: "Ana"}}}
	svc := NewUserService(users)
	var pushed []Profile
	svc.OnChange = func(_ context.Context, p Profile) { pushed = append(pushed, p) }

	soon := time.Now().Add(time.Hour)
	p, err := svc.SetStatus(ctx, "u1", &Status{Emoji: "🌴", Text: "  On vacation ", Until: &soon})
	if err != nil || p.Status == nil || p.Status.Text != "On vacation" || p.Status.Emoji != "🌴" {
		t.Fatalf("set: %+v %v", p.Status, err)
	}
	if len(pushed) != 1 || pushed[0].Status == nil {
		t.Fatalf("OnChange should get the new profile, got %+v", pushed)
	}

	past := time.Now().Add(-time.Minute)
	if _, err := svc.SetStatus(ctx, "u1", &Status{Text: "x", Until: &past}); err == nil {
		t.Fatal("a clear-after time in the past should be rejected")
	}
	if _, err := svc.SetStatus(ctx, "u1", &Status{Text: strings.Repeat("a", 101)}); err == nil {
		t.Fatal("a 101-character status should be rejected")
	}

	// An expired status is hidden even before anyone clears it.
	users.byID["u1"].StatusUntil = &past
	if me, _ := svc.Me(ctx, "u1"); me.Status != nil {
		t.Fatalf("expired status should be hidden, got %+v", me.Status)
	}

	if p, err := svc.SetStatus(ctx, "u1", nil); err != nil || p.Status != nil || users.byID["u1"].StatusText != "" {
		t.Fatalf("clear: %+v %v", p.Status, err)
	}
}
