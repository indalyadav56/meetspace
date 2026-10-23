package di

import (
	"context"
	"fmt"
	"html"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	docsapp "github.com/indalyadav56/meetspace/backend/internal/docs/application"
	identityapp "github.com/indalyadav56/meetspace/backend/internal/identity/application"
	workapp "github.com/indalyadav56/meetspace/backend/internal/work/application"
	workdomain "github.com/indalyadav56/meetspace/backend/internal/work/domain"
	workspaceapp "github.com/indalyadav56/meetspace/backend/internal/workspace/application"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
	"github.com/indalyadav56/meetspace/backend/pkg/optional"
)

// assistantTools implements the assistant's WorkspaceTools port on top of the
// work, docs, workspace and identity services.
type assistantTools struct {
	work       *workapp.Service
	docs       *docsapp.Service
	workspaces *workspaceapp.Service
	users      *identityapp.UserService
}

type view struct {
	st       *workapp.State
	names    map[string]string // user id -> name
	projects map[string]workdomain.Project
	lists    map[string]workdomain.List
	byID     map[string]*workdomain.Task
}

func (a assistantTools) load(ctx context.Context, ws string) (*view, error) {
	st, err := a.work.State(ctx, ws)
	if err != nil {
		return nil, err
	}
	ids, err := a.workspaces.MemberIDs(ctx, ws)
	if err != nil {
		return nil, err
	}
	ps, err := a.users.Profiles(ctx, ids)
	if err != nil {
		return nil, err
	}
	v := &view{st: st, names: map[string]string{}, projects: map[string]workdomain.Project{}, lists: map[string]workdomain.List{}, byID: map[string]*workdomain.Task{}}
	for _, p := range ps {
		v.names[p.ID] = p.Name
	}
	for _, p := range st.Projects {
		v.projects[p.ID] = p
	}
	for _, l := range st.Lists {
		v.lists[l.ID] = l
	}
	for i := range st.Tasks {
		v.byID[st.Tasks[i].ID] = &st.Tasks[i]
	}
	return v, nil
}

func (v *view) status(t *workdomain.Task) workdomain.Status {
	p := v.projects[v.lists[t.ListID].ProjectID]
	s, _ := p.Status(t.StatusID)
	return s
}

func (v *view) summary(t *workdomain.Task) map[string]any {
	names := make([]string, 0, len(t.Assignees))
	for _, a := range t.Assignees {
		names = append(names, v.names[a])
	}
	blocked := []string{}
	for _, b := range t.BlockedBy {
		if bt := v.byID[b]; bt != nil {
			blocked = append(blocked, "MS-"+strconv.FormatInt(bt.Key, 10))
		}
	}
	st := v.status(t)
	l := v.lists[t.ListID]
	return map[string]any{
		"key": "MS-" + strconv.FormatInt(t.Key, 10), "title": t.Title, "status": st.Name, "done": st.Finished(),
		"priority": t.Priority, "assignees": names, "due_date": t.DueDate, "start_date": t.StartDate,
		"list": l.Name, "project": v.projects[l.ProjectID].Name, "tags": t.Tags, "blocked_by": blocked,
	}
}

var keyRe = regexp.MustCompile(`(?i)^(?:MS-)?(\d+)$`)

func (v *view) find(ref string) *workdomain.Task {
	ref = strings.TrimSpace(ref)
	if m := keyRe.FindStringSubmatch(ref); m != nil {
		k, _ := strconv.ParseInt(m[1], 10, 64)
		for i := range v.st.Tasks {
			if v.st.Tasks[i].Key == k {
				return &v.st.Tasks[i]
			}
		}
		return nil
	}
	q := strings.ToLower(strings.Trim(ref, `"“”`))
	for i := range v.st.Tasks {
		if strings.ToLower(v.st.Tasks[i].Title) == q {
			return &v.st.Tasks[i]
		}
	}
	for i := range v.st.Tasks {
		if strings.Contains(strings.ToLower(v.st.Tasks[i].Title), q) {
			return &v.st.Tasks[i]
		}
	}
	return nil
}

func (v *view) findUser(ref, me string) (string, bool) {
	q := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(ref), "@"))
	if q == "me" || q == "myself" || q == "i" {
		return me, true
	}
	var partial string
	for id, n := range v.names {
		ln := strings.ToLower(n)
		if ln == q {
			return id, true
		}
		for _, part := range strings.Fields(ln) {
			if part == q {
				partial = id
			}
		}
		if partial == "" && strings.Contains(ln, q) {
			partial = id
		}
	}
	return partial, partial != ""
}

func (v *view) findList(ref string) *workdomain.List {
	q := strings.ToLower(strings.TrimSpace(ref))
	for _, l := range v.st.Lists {
		if strings.ToLower(l.Name) == q {
			l := l
			return &l
		}
	}
	for _, l := range v.st.Lists {
		if strings.Contains(strings.ToLower(l.Name), q) {
			l := l
			return &l
		}
	}
	return nil
}

func (v *view) memberNames() string {
	ns := make([]string, 0, len(v.names))
	for _, n := range v.names {
		ns = append(ns, n)
	}
	sort.Strings(ns)
	return strings.Join(ns, ", ")
}

func daysUntil(date *string) (int, bool) {
	if date == nil {
		return 0, false
	}
	d, err := time.Parse("2006-01-02", *date)
	if err != nil {
		return 0, false
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	return int(d.Sub(today).Hours() / 24), true
}

func (a assistantTools) Overview(ctx context.Context, ws, userID string) (map[string]any, error) {
	v, err := a.load(ctx, ws)
	if err != nil {
		return nil, err
	}
	var top []*workdomain.Task
	for i := range v.st.Tasks {
		if v.st.Tasks[i].ParentID == nil {
			top = append(top, &v.st.Tasks[i])
		}
	}
	counts := map[string]int{"total": len(top)}
	overdue, week := []map[string]any{}, []map[string]any{}
	workload := map[string]int{}
	for _, t := range top {
		st := v.status(t)
		switch {
		case st.Finished():
			counts["done"]++
		case st.Type == workdomain.StatusActive:
			counts["in_progress"]++
		default:
			counts["not_started"]++
		}
		if st.Finished() {
			continue
		}
		for _, as := range t.Assignees {
			workload[v.names[as]]++
		}
		if d, ok := daysUntil(t.DueDate); ok {
			if d < 0 {
				overdue = append(overdue, v.summary(t))
			} else if d <= 7 {
				week = append(week, v.summary(t))
			}
		}
	}
	projects := []map[string]any{}
	for _, p := range v.st.Projects {
		total, done := 0, 0
		for _, t := range top {
			if v.lists[t.ListID].ProjectID == p.ID {
				total++
				if v.status(t).Finished() {
					done++
				}
			}
		}
		projects = append(projects, map[string]any{"name": p.Name, "total": total, "done": done})
	}
	recent := []map[string]any{}
	acts := v.st.Activity
	for i := len(acts) - 1; i >= 0 && len(recent) < 12; i-- {
		who := v.names[acts[i].UserID]
		if acts[i].UserID == workdomain.BotID {
			who = "Automation"
		}
		task := ""
		if t := v.byID[acts[i].TaskID]; t != nil {
			task = t.Title
		}
		recent = append(recent, map[string]any{"who": who, "what": acts[i].Text, "task": task, "when": acts[i].CreatedAt})
	}
	return map[string]any{
		"today": time.Now().UTC().Format("2006-01-02"), "current_user": v.names[userID], "projects": projects,
		"counts": counts, "overdue": overdue, "due_this_week": week, "open_tasks_per_person": workload, "recent_activity": recent,
	}, nil
}

func (a assistantTools) ListProjects(ctx context.Context, ws string) (map[string]any, error) {
	v, err := a.load(ctx, ws)
	if err != nil {
		return nil, err
	}
	folders := map[string]string{}
	for _, f := range v.st.Folders {
		folders[f.ID] = f.Name
	}
	projects := []map[string]any{}
	for _, p := range v.st.Projects {
		statuses := []string{}
		for _, s := range p.Statuses {
			statuses = append(statuses, s.Name)
		}
		lists := []map[string]any{}
		for _, l := range v.st.Lists {
			if l.ProjectID != p.ID {
				continue
			}
			n := 0
			for _, t := range v.st.Tasks {
				if t.ListID == l.ID && t.ParentID == nil {
					n++
				}
			}
			folder := ""
			if l.FolderID != nil {
				folder = folders[*l.FolderID]
			}
			lists = append(lists, map[string]any{"name": l.Name, "folder": folder, "tasks": n})
		}
		projects = append(projects, map[string]any{"name": p.Name, "statuses": statuses, "lists": lists})
	}
	return map[string]any{"members": v.memberNames(), "projects": projects}, nil
}

func (a assistantTools) SearchTasks(ctx context.Context, ws, userID string, f map[string]string, limit int) (map[string]any, error) {
	v, err := a.load(ctx, ws)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var who string
	if as := f["assignee"]; as != "" && strings.ToLower(as) != "unassigned" {
		id, ok := v.findUser(as, userID)
		if !ok {
			return nil, apperror.Invalid("unknown_person", "no member matches \""+as+"\". Members: "+v.memberNames())
		}
		who = id
	}
	var listFilter *workdomain.List
	if f["list"] != "" {
		if listFilter = v.findList(f["list"]); listFilter == nil {
			return nil, apperror.Invalid("unknown_list", "no List matches \""+f["list"]+"\"")
		}
	}
	words := strings.Fields(strings.ToLower(f["query"]))
	var out []*workdomain.Task
	for i := range v.st.Tasks {
		t := &v.st.Tasks[i]
		if t.ParentID != nil {
			continue
		}
		title := strings.ToLower(t.Title)
		match := true
		for _, w := range words {
			match = match && strings.Contains(title, w)
		}
		st := v.status(t)
		switch f["state"] {
		case "open":
			match = match && st.Type == workdomain.StatusOpen
		case "in_progress":
			match = match && st.Type == workdomain.StatusActive
		case "done":
			match = match && st.Finished()
		case "not_done":
			match = match && !st.Finished()
		}
		d, has := daysUntil(t.DueDate)
		switch f["due"] {
		case "overdue":
			match = match && has && d < 0 && !st.Finished()
		case "today":
			match = match && has && d == 0
		case "this_week":
			match = match && has && d >= 0 && d <= 7
		case "no_date":
			match = match && !has
		}
		if strings.ToLower(f["assignee"]) == "unassigned" {
			match = match && len(t.Assignees) == 0
		} else if who != "" {
			found := false
			for _, as := range t.Assignees {
				found = found || as == who
			}
			match = match && found
		}
		if f["project"] != "" {
			match = match && strings.Contains(strings.ToLower(v.projects[v.lists[t.ListID].ProjectID].Name), strings.ToLower(f["project"]))
		}
		if listFilter != nil {
			match = match && t.ListID == listFilter.ID
		}
		if f["priority"] != "" {
			match = match && t.Priority != nil && *t.Priority == f["priority"]
		}
		if match {
			out = append(out, t)
		}
	}
	rank := map[string]int{"urgent": 0, "high": 1, "normal": 2, "low": 3}
	sort.SliceStable(out, func(i, j int) bool {
		di, dj := "9999", "9999"
		if out[i].DueDate != nil {
			di = *out[i].DueDate
		}
		if out[j].DueDate != nil {
			dj = *out[j].DueDate
		}
		if di != dj {
			return di < dj
		}
		pr := func(t *workdomain.Task) int {
			if t.Priority == nil {
				return 4
			}
			return rank[*t.Priority]
		}
		return pr(out[i]) < pr(out[j])
	})
	res := []map[string]any{}
	for i, t := range out {
		if i >= limit {
			break
		}
		res = append(res, v.summary(t))
	}
	return map[string]any{"total_matches": len(out), "tasks": res}, nil
}

func (a assistantTools) GetTask(ctx context.Context, ws, ref string) (map[string]any, error) {
	v, err := a.load(ctx, ws)
	if err != nil {
		return nil, err
	}
	t := v.find(ref)
	if t == nil {
		return nil, apperror.NotFound("task_not_found", "no task matches \""+ref+"\"")
	}
	out := v.summary(t)
	out["description"] = stripHTML(t.Description)
	out["estimate_hours"] = t.Estimate
	out["recurrence"] = t.Recurrence
	checklist := []string{}
	for _, c := range t.Checklist {
		box := "[ ]"
		if c.Done {
			box = "[x]"
		}
		checklist = append(checklist, box+" "+c.Text)
	}
	out["checklist"] = checklist
	subs, blocking, comments := []map[string]any{}, []string{}, []map[string]any{}
	for i := range v.st.Tasks {
		x := &v.st.Tasks[i]
		if x.ParentID != nil && *x.ParentID == t.ID {
			subs = append(subs, v.summary(x))
		}
		for _, b := range x.BlockedBy {
			if b == t.ID {
				blocking = append(blocking, "MS-"+strconv.FormatInt(x.Key, 10))
			}
		}
	}
	for _, c := range v.st.Comments {
		if c.TaskID == t.ID {
			by := v.names[c.UserID]
			if c.UserID == workdomain.BotID {
				by = "Automation"
			}
			comments = append(comments, map[string]any{"by": by, "text": c.Text, "at": c.CreatedAt})
		}
	}
	minutes := 0
	for _, e := range v.st.TimeEntries {
		if e.TaskID == t.ID {
			minutes += e.Duration
		}
	}
	out["subtasks"], out["blocking"], out["comments"] = subs, blocking, comments
	out["time_tracked_minutes"] = minutes
	out["effect"] = map[string]any{"label": "Read " + out["key"].(string), "taskId": t.ID}
	return out, nil
}

func (a assistantTools) CreateTask(ctx context.Context, ws, userID string, args map[string]any) (map[string]any, error) {
	v, err := a.load(ctx, ws)
	if err != nil {
		return nil, err
	}
	in := workapp.TaskInput{Title: str(args, "title"), Description: markdownToHTML(str(args, "description"))}
	if p := str(args, "parent_task"); p != "" {
		parent := v.find(p)
		if parent == nil {
			return nil, apperror.NotFound("task_not_found", "no parent task matches \""+p+"\"")
		}
		in.ParentID, in.ListID = &parent.ID, parent.ListID
	} else if l := str(args, "list"); l != "" {
		list := v.findList(l)
		if list == nil {
			return nil, apperror.Invalid("unknown_list", "no List matches \""+l+"\"; call list_projects for valid names")
		}
		in.ListID = list.ID
	} else if len(v.st.Lists) > 0 {
		in.ListID = v.st.Lists[0].ID
	} else {
		return nil, apperror.Invalid("no_lists", "this workspace has no Lists yet")
	}
	for _, n := range strs(args, "assignees") {
		id, ok := v.findUser(n, userID)
		if !ok {
			return nil, apperror.Invalid("unknown_person", "no member matches \""+n+"\". Members: "+v.memberNames())
		}
		in.Assignees = append(in.Assignees, id)
	}
	if d := str(args, "due_date"); d != "" {
		in.DueDate = &d
	}
	if d := str(args, "start_date"); d != "" {
		in.StartDate = &d
	}
	if p := str(args, "priority"); p != "" {
		in.Priority = &p
	}
	in.Tags = strs(args, "tags")
	t, err := a.work.CreateTask(ctx, ws, userID, in)
	if err != nil {
		return nil, err
	}
	v.byID[t.ID] = t
	out := v.summary(t)
	return map[string]any{"created": out, "effect": map[string]any{"label": "Created " + out["key"].(string), "taskId": t.ID}}, nil
}

func (a assistantTools) UpdateTask(ctx context.Context, ws, userID string, args map[string]any) (map[string]any, error) {
	v, err := a.load(ctx, ws)
	if err != nil {
		return nil, err
	}
	t := v.find(str(args, "task"))
	if t == nil {
		return nil, apperror.NotFound("task_not_found", "no task matches \""+str(args, "task")+"\"")
	}
	var p workapp.TaskPatch
	if s := str(args, "title"); s != "" {
		p.Title = optional.Of(s)
	}
	if s := str(args, "status"); s != "" {
		proj := v.projects[v.lists[t.ListID].ProjectID]
		id := ""
		q := strings.ToLower(s)
		for _, st := range proj.Statuses {
			if strings.ToLower(st.Name) == q {
				id = st.ID
			}
		}
		if id == "" {
			typ := map[string]workdomain.StatusType{"done": workdomain.StatusDone, "complete": workdomain.StatusDone, "completed": workdomain.StatusDone, "open": workdomain.StatusOpen, "todo": workdomain.StatusOpen, "to do": workdomain.StatusOpen, "active": workdomain.StatusActive, "started": workdomain.StatusActive}[q]
			for _, st := range proj.Statuses {
				if id == "" && (strings.Contains(strings.ToLower(st.Name), q) || (typ != "" && st.Type == typ)) {
					id = st.ID
				}
			}
		}
		if id == "" {
			names := []string{}
			for _, st := range proj.Statuses {
				names = append(names, st.Name)
			}
			return nil, apperror.Invalid("unknown_status", "status \""+s+"\" doesn't exist here. Options: "+strings.Join(names, ", "))
		}
		p.StatusID = optional.Of(id)
	}
	if s := str(args, "priority"); s != "" {
		if s == "none" {
			p.Priority = optional.Null[string]()
		} else {
			p.Priority = optional.Of(s)
		}
	}
	if s := str(args, "due_date"); s != "" {
		p.DueDate = optional.Of(s)
	}
	if b, _ := args["clear_due_date"].(bool); b {
		p.DueDate = optional.Null[string]()
	}
	if s := str(args, "start_date"); s != "" {
		p.StartDate = optional.Of(s)
	}
	add, remove := strs(args, "add_assignees"), strs(args, "remove_assignees")
	if len(add)+len(remove) > 0 {
		next := append([]string{}, t.Assignees...)
		for _, n := range add {
			id, ok := v.findUser(n, userID)
			if !ok {
				return nil, apperror.Invalid("unknown_person", "no member matches \""+n+"\"")
			}
			next = append(next, id)
		}
		for _, n := range remove {
			if id, ok := v.findUser(n, userID); ok {
				kept := next[:0]
				for _, x := range next {
					if x != id {
						kept = append(kept, x)
					}
				}
				next = kept
			}
		}
		p.Assignees = optional.Of(next)
	}
	if tags := strs(args, "add_tags"); len(tags) > 0 {
		p.Tags = optional.Of(append(append([]string{}, t.Tags...), tags...))
	}
	updated, err := a.work.UpdateTask(ctx, ws, userID, t.ID, p)
	if err != nil {
		return nil, err
	}
	out := v.summary(updated)
	return map[string]any{"updated": out, "effect": map[string]any{"label": "Updated " + out["key"].(string), "taskId": t.ID}}, nil
}

func (a assistantTools) AddComment(ctx context.Context, ws, userID, ref, text string) (map[string]any, error) {
	v, err := a.load(ctx, ws)
	if err != nil {
		return nil, err
	}
	t := v.find(ref)
	if t == nil {
		return nil, apperror.NotFound("task_not_found", "no task matches \""+ref+"\"")
	}
	if _, err := a.work.AddComment(ctx, ws, userID, t.ID, text, nil, mentionResolver{workspaces: a.workspaces, users: a.users}); err != nil {
		return nil, err
	}
	key := "MS-" + strconv.FormatInt(t.Key, 10)
	return map[string]any{"ok": true, "task": key, "effect": map[string]any{"label": "Commented on " + key, "taskId": t.ID}}, nil
}

func (a assistantTools) GetDoc(ctx context.Context, ws, title string) (map[string]any, error) {
	docs, err := a.docs.ListDocs(ctx, ws)
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(strings.TrimSpace(title))
	for pass := 0; pass < 2; pass++ {
		for _, d := range docs {
			t := strings.ToLower(d.Title)
			if (pass == 0 && t == q) || (pass == 1 && strings.Contains(t, q)) {
				return map[string]any{"title": d.Title, "text": stripHTML(d.Content), "updated": d.UpdatedAt,
					"effect": map[string]any{"label": "Read “" + d.Title + "”", "docId": d.ID}}, nil
			}
		}
	}
	names := []string{}
	for _, d := range docs {
		names = append(names, d.Title)
	}
	return nil, apperror.NotFound("doc_not_found", fmt.Sprintf("no doc matches %q. Docs: %s", title, strings.Join(names, ", ")))
}

func (a assistantTools) CreateDoc(ctx context.Context, ws, userID, title, markdown, project string) (map[string]any, error) {
	var projectID *string
	if project != "" {
		v, err := a.load(ctx, ws)
		if err != nil {
			return nil, err
		}
		for _, p := range v.st.Projects {
			if strings.EqualFold(p.Name, project) {
				id := p.ID
				projectID = &id
			}
		}
	}
	d, err := a.docs.CreateDoc(ctx, ws, userID, "", projectID, title, markdownToHTML(markdown), "✨")
	if err != nil {
		return nil, err
	}
	return map[string]any{"created": d.Title, "effect": map[string]any{"label": "Created doc “" + d.Title + "”", "docId": d.ID}}, nil
}

// ---- helpers

func str(m map[string]any, k string) string {
	s, _ := m[k].(string)
	return strings.TrimSpace(s)
}

func strs(m map[string]any, k string) []string {
	switch v := m[k].(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, x := range v {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

var tagRe = regexp.MustCompile(`<[^>]+>`)

func stripHTML(s string) string {
	s = strings.NewReplacer("</p>", "\n", "</li>", "\n", "</h1>", "\n", "</h2>", "\n", "</h3>", "\n", "<br>", "\n").Replace(s)
	return strings.TrimSpace(html.UnescapeString(tagRe.ReplaceAllString(s, "")))
}

var (
	boldRe = regexp.MustCompile(`\*\*(.+?)\*\*`)
	codeRe = regexp.MustCompile("`(.+?)`")
)

func inline(s string) string {
	s = html.EscapeString(s)
	s = boldRe.ReplaceAllString(s, "<strong>$1</strong>")
	return codeRe.ReplaceAllString(s, "<code>$1</code>")
}

// markdownToHTML converts the small Markdown subset the assistant writes into editor HTML.
func markdownToHTML(md string) string {
	if strings.TrimSpace(md) == "" {
		return ""
	}
	var b strings.Builder
	list := ""
	closeList := func() {
		if list != "" {
			b.WriteString(map[string]string{"ul": "</ul>", "ol": "</ol>", "task": "</ul>"}[list])
			list = ""
		}
	}
	open := func(kind, tag string) {
		if list != kind {
			closeList()
			b.WriteString(tag)
			list = kind
		}
	}
	taskRe := regexp.MustCompile(`^\s*[-*]\s+\[( |x|X)\]\s+(.*)`)
	bulletRe := regexp.MustCompile(`^\s*[-*]\s+(.*)`)
	numRe := regexp.MustCompile(`^\s*\d+[.)]\s+(.*)`)
	headRe := regexp.MustCompile(`^(#{1,3})\s+(.*)`)
	for _, line := range strings.Split(md, "\n") {
		line = strings.TrimRight(line, " \t\r")
		switch {
		case headRe.MatchString(line):
			closeList()
			m := headRe.FindStringSubmatch(line)
			n := strconv.Itoa(len(m[1]))
			b.WriteString("<h" + n + ">" + inline(m[2]) + "</h" + n + ">")
		case taskRe.MatchString(line):
			open("task", `<ul data-type="taskList">`)
			m := taskRe.FindStringSubmatch(line)
			b.WriteString(fmt.Sprintf(`<li data-type="taskItem" data-checked="%t"><p>%s</p></li>`, strings.EqualFold(m[1], "x"), inline(m[2])))
		case bulletRe.MatchString(line):
			open("ul", "<ul>")
			b.WriteString("<li><p>" + inline(bulletRe.FindStringSubmatch(line)[1]) + "</p></li>")
		case numRe.MatchString(line):
			open("ol", "<ol>")
			b.WriteString("<li><p>" + inline(numRe.FindStringSubmatch(line)[1]) + "</p></li>")
		case strings.TrimSpace(line) == "":
			closeList()
		default:
			closeList()
			b.WriteString("<p>" + inline(line) + "</p>")
		}
	}
	closeList()
	return b.String()
}
