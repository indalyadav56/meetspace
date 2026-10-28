package application

import (
	"testing"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

func TestWhoSeesASpace(t *testing.T) {
	open := &domain.Project{ID: "open"}
	private := &domain.Project{ID: "priv", Private: true, Members: []string{"mia"}}
	shared := &domain.Project{ID: "shared", Members: []string{"gus"}}
	cases := []struct {
		user, role string
		p          *domain.Project
		want       bool
	}{
		{"own", "owner", private, true},
		{"adm", "admin", private, true},
		{"mem", "member", open, true},
		{"mem", "member", private, false},
		{"mia", "member", private, true},
		{"gus", "guest", open, false},
		{"gus", "guest", shared, true},
		{"gus", "guest", private, false},
	}
	for _, c := range cases {
		if got := viewerFor(c.user, c.role).sees(c.p); got != c.want {
			t.Errorf("%s (%s) sees %s = %v, want %v", c.user, c.role, c.p.ID, got, c.want)
		}
	}
}

func TestFilterStateDropsEverythingInAHiddenSpace(t *testing.T) {
	st := &State{
		Projects:    []domain.Project{{ID: "a"}, {ID: "b"}},
		Folders:     []domain.Folder{{ID: "fa", ProjectID: "a"}, {ID: "fb", ProjectID: "b"}},
		Lists:       []domain.List{{ID: "la", ProjectID: "a"}, {ID: "lb", ProjectID: "b"}},
		Tasks:       []domain.Task{{ID: "ta", ListID: "la"}, {ID: "tb", ListID: "lb"}},
		Comments:    []domain.Comment{{ID: "ca", TaskID: "ta"}, {ID: "cb", TaskID: "tb"}},
		Activity:    []domain.Activity{{ID: "aa", TaskID: "ta"}, {ID: "ab", TaskID: "tb"}},
		TimeEntries: []domain.TimeEntry{{ID: "ea", TaskID: "ta"}, {ID: "eb", TaskID: "tb"}},
		Fields:      []domain.CustomField{{ID: "xa", ListID: "la"}, {ID: "xb", ListID: "lb"}},
		Sprints:     []domain.Sprint{{ID: "sa", ProjectID: "a"}, {ID: "sb", ProjectID: "b"}},
		Automations: []domain.Automation{{ID: "ma", ProjectID: "a"}, {ID: "mb", ProjectID: "b"}},
		Forms:       []domain.Form{{ID: "oa", ListID: "la"}, {ID: "ob", ListID: "lb"}},
	}
	filterState(st, map[string]bool{"b": true})
	if len(st.Projects) != 1 || len(st.Folders) != 1 || len(st.Lists) != 1 || len(st.Tasks) != 1 || len(st.Comments) != 1 ||
		len(st.Activity) != 1 || len(st.TimeEntries) != 1 || len(st.Fields) != 1 || len(st.Sprints) != 1 || len(st.Automations) != 1 || len(st.Forms) != 1 {
		t.Fatalf("something from the hidden Space survived: %+v", st)
	}
	if st.Tasks[0].ID != "ta" || st.Comments[0].ID != "ca" {
		t.Fatal("the visible Space lost items")
	}
}
