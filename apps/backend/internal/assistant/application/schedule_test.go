package application

import (
	"testing"
	"time"
)

func TestNextRun(t *testing.T) {
	// Friday 2026-10-30 10:00 UTC
	fri := time.Date(2026, 10, 30, 10, 0, 0, 0, time.UTC)
	cases := []struct {
		schedule, at string
		day          int
		tz           string
		want         string
	}{
		{"daily", "09:00", 0, "UTC", "2026-10-31T09:00:00Z"},    // already past today's 09:00
		{"daily", "11:30", 0, "UTC", "2026-10-30T11:30:00Z"},    // later today
		{"weekdays", "09:00", 0, "UTC", "2026-11-02T09:00:00Z"}, // skips the weekend
		{"weekly", "08:00", 1, "UTC", "2026-11-02T08:00:00Z"},   // next Monday
		{"daily", "09:00", 0, "Asia/Kolkata", "2026-10-31T03:30:00Z"},
	}
	for _, c := range cases {
		got := NextRun(c.schedule, c.at, c.day, c.tz, fri)
		if got == nil || got.UTC().Format(time.RFC3339) != c.want {
			t.Errorf("%s %s day=%d %s: got %v, want %s", c.schedule, c.at, c.day, c.tz, got, c.want)
		}
	}
	if NextRun("none", "09:00", 0, "UTC", fri) != nil {
		t.Fatal("unscheduled agents have no next run")
	}
}
