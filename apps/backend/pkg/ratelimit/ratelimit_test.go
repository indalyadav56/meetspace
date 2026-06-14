package ratelimit

import (
	"testing"
	"time"
)

func TestLimiter_AllowsUpToMaxThenBlocks(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	l := New(2, time.Minute, WithClock(func() time.Time { return now }))

	if !l.Allow("ip-a") {
		t.Fatal("hit 1 should be allowed")
	}
	if !l.Allow("ip-a") {
		t.Fatal("hit 2 should be allowed")
	}
	if l.Allow("ip-a") {
		t.Fatal("hit 3 should be blocked")
	}
}

func TestLimiter_KeysAreIndependent(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	l := New(1, time.Minute, WithClock(func() time.Time { return now }))

	if !l.Allow("ip-a") {
		t.Fatal("ip-a first hit should be allowed")
	}
	if !l.Allow("ip-b") {
		t.Fatal("ip-b should not be affected by ip-a's count")
	}
	if l.Allow("ip-a") {
		t.Fatal("ip-a second hit should be blocked")
	}
}

func TestLimiter_WindowResets(t *testing.T) {
	now := time.Date(2026, 6, 13, 12, 0, 0, 0, time.UTC)
	l := New(1, time.Minute, WithClock(func() time.Time { return now }))

	if !l.Allow("ip-a") {
		t.Fatal("first hit should be allowed")
	}
	if l.Allow("ip-a") {
		t.Fatal("second hit in window should be blocked")
	}

	now = now.Add(time.Minute + time.Second)
	if !l.Allow("ip-a") {
		t.Fatal("hit after the window elapses should be allowed")
	}
}
