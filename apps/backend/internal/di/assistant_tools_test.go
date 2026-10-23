package di

import (
	"testing"

	workapp "github.com/indalyadav56/meetspace/backend/internal/work/application"
	workdomain "github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

func TestMarkdownToHTML(t *testing.T) {
	cases := map[string]string{
		"":                       "",
		"# Plan\nShip **it**":    "<h1>Plan</h1><p>Ship <strong>it</strong></p>",
		"- a\n- b\n\n1. one":     "<ul><li><p>a</p></li><li><p>b</p></li></ul><ol><li><p>one</p></li></ol>",
		"- [x] done\n- [ ] todo": `<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li><li data-type="taskItem" data-checked="false"><p>todo</p></li></ul>`,
		"<script>":               "<p>&lt;script&gt;</p>",
		"use `go test`":          "<p>use <code>go test</code></p>",
	}
	for in, want := range cases {
		if got := markdownToHTML(in); got != want {
			t.Errorf("markdownToHTML(%q)\n got %s\nwant %s", in, got, want)
		}
	}
}

func TestStripHTML(t *testing.T) {
	if got := stripHTML("<h1>Title</h1><p>A &amp; B</p>"); got != "Title\nA & B" {
		t.Fatalf("got %q", got)
	}
}

func testView() *view {
	tasks := []workdomain.Task{
		{ID: "a", Key: 101, Title: "Fix login bug"},
		{ID: "b", Key: 102, Title: "Login page redesign"},
	}
	return &view{
		st:    &workapp.State{Tasks: tasks},
		names: map[string]string{"u1": "Ann Lee", "u2": "Bob Stone"},
	}
}

func TestFindTask(t *testing.T) {
	v := testView()
	for ref, want := range map[string]string{"MS-102": "b", "101": "a", "fix login bug": "a", "redesign": "b"} {
		if got := v.find(ref); got == nil || got.ID != want {
			t.Errorf("find(%q) = %v, want %s", ref, got, want)
		}
	}
	if v.find("MS-999") != nil {
		t.Error("unknown key matched a task")
	}
}

func TestFindUser(t *testing.T) {
	v := testView()
	for ref, want := range map[string]string{"me": "u0", "@Ann Lee": "u1", "bob": "u2", "Stone": "u2"} {
		if got, ok := v.findUser(ref, "u0"); !ok || got != want {
			t.Errorf("findUser(%q) = %q, want %s", ref, got, want)
		}
	}
	if _, ok := v.findUser("zed", "u0"); ok {
		t.Error("unknown person matched")
	}
}
