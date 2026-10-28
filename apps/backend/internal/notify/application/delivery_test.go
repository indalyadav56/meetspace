package application

import (
	"testing"

	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
)

func TestQuietHours(t *testing.T) {
	cases := []struct {
		hour, start, end int
		want             bool
	}{
		{23, 22, 7, true}, {3, 22, 7, true}, {7, 22, 7, false}, {12, 22, 7, false},
		{13, 12, 14, true}, {14, 12, 14, false}, {5, -1, -1, false}, {5, 5, 5, false},
	}
	for _, c := range cases {
		if got := quiet(c.hour, c.start, c.end); got != c.want {
			t.Errorf("quiet(%d, %d, %d) = %v, want %v", c.hour, c.start, c.end, got, c.want)
		}
	}
}

func TestLineDoesNotRepeatTheActor(t *testing.T) {
	o := domain.Outgoing{ActorName: "Priya Shah"}
	o.Text = "Priya Shah submitted their timesheet"
	if Line(o) != "Priya Shah submitted their timesheet" {
		t.Fatal(Line(o))
	}
	o.Text = "assigned you"
	if Line(o) != "Priya Shah assigned you" {
		t.Fatal(Line(o))
	}
}
