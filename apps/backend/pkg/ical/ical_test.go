package ical

import (
	"strings"
	"testing"
	"time"
)

func TestEscape(t *testing.T) {
	if got := Escape("a,b;c\\d\nnew"); got != `a\,b\;c\\d\nnew` {
		t.Fatal(got)
	}
}

func TestFoldKeepsLinesShortAndRunesWhole(t *testing.T) {
	long := "SUMMARY:" + strings.Repeat("ü", 60) // 2 bytes each
	out := fold(long)
	for _, l := range strings.Split(out, "\r\n") {
		if len(l) > 75 {
			t.Fatalf("line too long: %d", len(l))
		}
	}
	if strings.ReplaceAll(out, "\r\n ", "") != long {
		t.Fatal("unfolding must give back the original")
	}
}

func TestCalendar(t *testing.T) {
	now := time.Date(2026, 10, 28, 9, 0, 0, 0, time.UTC)
	day := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	cal := Calendar("Work", []Event{
		{UID: "t1@x", Summary: "Ship, it", Start: day, End: day.AddDate(0, 0, 1), AllDay: true},
		{UID: "m1@x", Summary: "Standup", Start: now, End: now.Add(15 * time.Minute)},
	}, now)
	for _, want := range []string{"BEGIN:VCALENDAR\r\n", "DTSTART;VALUE=DATE:20261102", "DTEND;VALUE=DATE:20261103", `SUMMARY:Ship\, it`, "DTSTART:20261028T090000Z", "DTEND:20261028T091500Z", "END:VCALENDAR\r\n"} {
		if !strings.Contains(cal, want) {
			t.Errorf("missing %q", want)
		}
	}
}
