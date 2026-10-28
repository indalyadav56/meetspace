package application

import (
	"net/http"
	"strings"
)

// verbs are trailing route segments that name an action on the resource
// before them (POST /tasks/:id/restore) rather than a sub-collection.
var verbs = map[string]bool{
	"restore": true, "purge": true, "read": true, "archive": true, "complete": true, "move": true, "duplicate": true,
	"reorder": true, "submit": true, "approve": true, "reject": true, "resolve": true, "start": true, "stop": true,
	"join": true, "leave": true, "end": true, "upload": true, "bulk": true, "run": true, "test": true, "sync": true,
	"send": true, "reactions": true, "transfer": true, "invite": true, "accept": true, "rotate": true, "enable": true,
	"disable": true, "import": true, "share": true, "revoke": true,
}

var methodVerb = map[string]string{http.MethodPost: "created", http.MethodPut: "updated", http.MethodPatch: "updated", http.MethodDelete: "deleted"}

// singular turns a route collection into an entity name: "tasks" → "task", "activities" → "activity".
func singular(s string) string {
	s = strings.ReplaceAll(s, "-", "_")
	switch {
	case strings.HasSuffix(s, "ies"):
		return strings.TrimSuffix(s, "ies") + "y"
	case strings.HasSuffix(s, "sses"), strings.HasSuffix(s, "xes"):
		return s[:len(s)-2]
	case strings.HasSuffix(s, "s") && !strings.HasSuffix(s, "ss"):
		return strings.TrimSuffix(s, "s")
	}
	return s
}

// Describe derives an audit action and entity type from a request's method and
// route template relative to the workspace, e.g. ("PATCH", "/tasks/:id") →
// ("task.updated", "task") and ("POST", "/tasks/:id/restore") → ("task.restore", "task").
func Describe(method, route string) (action, entity string) {
	var static []string
	endsWithParam := false
	for _, seg := range strings.Split(strings.Trim(route, "/"), "/") {
		if seg == "" {
			continue
		}
		if strings.HasPrefix(seg, ":") || strings.HasPrefix(seg, "*") {
			endsWithParam = true
			continue
		}
		endsWithParam = false
		static = append(static, seg)
	}
	if len(static) == 0 {
		return "workspace." + methodVerb[method], "workspace"
	}
	last := static[len(static)-1]
	if !endsWithParam && len(static) > 1 && verbs[last] {
		entity = singular(static[len(static)-2])
		return entity + "." + strings.ReplaceAll(last, "-", "_"), entity
	}
	entity = singular(last)
	verb := methodVerb[method]
	if verb == "" {
		verb = strings.ToLower(method)
	}
	return entity + "." + verb, entity
}
