package application

import (
	"testing"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/optional"
)

func TestDetailsPatch(t *testing.T) {
	d := domain.Details{}
	desc := "  Q4 launch work  "
	if err := (DetailsPatch{Description: &desc, Priority: optional.Of("high"), StartDate: optional.Of("2026-10-01"), DueDate: optional.Of("2026-10-31")}).apply(&d); err != nil {
		t.Fatal(err)
	}
	if d.Description != "Q4 launch work" || *d.Priority != "high" || *d.StartDate != "2026-10-01" || *d.DueDate != "2026-10-31" {
		t.Fatalf("unexpected details: %+v", d)
	}
	// Absent fields stay; null clears.
	if err := (DetailsPatch{Priority: optional.Null[string]()}).apply(&d); err != nil {
		t.Fatal(err)
	}
	if d.Priority != nil || d.DueDate == nil {
		t.Fatalf("null should clear only priority: %+v", d)
	}
	if err := (DetailsPatch{Priority: optional.Of("whenever")}).apply(&d); err == nil {
		t.Fatal("want invalid priority error")
	}
	if err := (DetailsPatch{StartDate: optional.Of("2026-11-15")}).apply(&d); err == nil {
		t.Fatal("start after due should be refused")
	}
	if err := (DetailsPatch{DueDate: optional.Of("not-a-date")}).apply(&d); err == nil {
		t.Fatal("want invalid date error")
	}
}
