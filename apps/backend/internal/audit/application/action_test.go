package application

import "testing"

func TestDescribe(t *testing.T) {
	cases := []struct{ method, route, action, entity string }{
		{"POST", "/tasks", "task.created", "task"},
		{"PATCH", "/tasks/:id", "task.updated", "task"},
		{"DELETE", "/tasks/:id", "task.deleted", "task"},
		{"POST", "/tasks/:id/restore", "task.restore", "task"},
		{"DELETE", "/tasks/:id/purge", "task.purge", "task"},
		{"POST", "/channels/:id/messages", "message.created", "message"},
		{"PATCH", "/members/:userId", "member.updated", "member"},
		{"POST", "/activities", "activity.created", "activity"},
		{"POST", "/time-entries", "time_entry.created", "time_entry"},
		{"PATCH", "", "workspace.updated", "workspace"},
		{"POST", "/messages/:id/reactions", "message.reactions", "message"},
	}
	for _, c := range cases {
		a, e := Describe(c.method, c.route)
		if a != c.action || e != c.entity {
			t.Errorf("%s %s = (%s, %s), want (%s, %s)", c.method, c.route, a, e, c.action, c.entity)
		}
	}
}
