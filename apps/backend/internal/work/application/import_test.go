package application

import (
	"testing"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

func TestImportStatusesKeepNamesAndOrder(t *testing.T) {
	sts := importStatuses([]ImportList{{Tasks: []ImportTask{
		{Status: "Done", StatusType: domain.StatusDone},
		{Status: "Backlog", StatusType: domain.StatusOpen},
		{Status: "In Review", StatusType: domain.StatusActive},
		{Status: "backlog", StatusType: domain.StatusOpen}, // same name, different case
	}}})
	var names []string
	for _, s := range sts {
		names = append(names, s.Name)
	}
	if len(sts) != 3 || names[0] != "Backlog" || names[1] != "In Review" || names[2] != "Done" {
		t.Fatalf("got %v", names)
	}
	if err := validateStatuses(sts); err != nil {
		t.Fatal(err)
	}
}

func TestImportStatusesAddMissingStartAndFinish(t *testing.T) {
	sts := importStatuses([]ImportList{{Tasks: []ImportTask{{Status: "Doing", StatusType: domain.StatusActive}}}})
	if len(sts) != 3 || sts[0].Type != domain.StatusOpen || sts[2].Type != domain.StatusDone {
		t.Fatalf("got %+v", sts)
	}
}

func TestStatusForMatchesByNameThenType(t *testing.T) {
	p := &domain.Project{Statuses: []domain.Status{
		{ID: "a", Name: "To do", Type: domain.StatusOpen}, {ID: "b", Name: "Doing", Type: domain.StatusActive}, {ID: "c", Name: "Shipped", Type: domain.StatusDone},
	}}
	if statusFor(p, ImportTask{Status: "doing"}) != "b" {
		t.Fatal("name match")
	}
	if statusFor(p, ImportTask{Status: "Closed", StatusType: domain.StatusDone}) != "c" {
		t.Fatal("type match")
	}
	if statusFor(p, ImportTask{Status: "???"}) != "a" {
		t.Fatal("fallback")
	}
}
