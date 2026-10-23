package application

import (
	"testing"
	"time"
)

func TestWeekOf(t *testing.T) {
	for in, want := range map[string]string{
		"2026-10-19T00:00:00Z": "2026-10-19", // Monday
		"2026-10-21T15:30:00Z": "2026-10-19", // Wednesday
		"2026-10-25T23:59:59Z": "2026-10-19", // Sunday belongs to the week before
		"2026-10-26T00:00:00Z": "2026-10-26",
	} {
		at, _ := time.Parse(time.RFC3339, in)
		if got := weekOf(at); got != want {
			t.Errorf("weekOf(%s) = %s, want %s", in, got, want)
		}
	}
	if _, err := parseWeek("2026-10-21"); err == nil {
		t.Error("a Wednesday was accepted as a week start")
	}
	if _, err := parseWeek("2026-10-19"); err != nil {
		t.Error(err)
	}
}
