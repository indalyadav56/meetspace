package application

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

const (
	maxImportTasks = 5000
	maxImportLists = 200
)

// ImportTask is one task from another tool, already parsed into our fields.
// Assignees are user ids the client matched to workspace members.
type ImportTask struct {
	Ref         string                 `json:"ref"`
	ParentRef   string                 `json:"parentRef"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Status      string                 `json:"status"`
	StatusType  domain.StatusType      `json:"statusType"`
	Priority    *string                `json:"priority"`
	Assignees   []string               `json:"assignees"`
	Tags        []string               `json:"tags"`
	StartDate   *string                `json:"startDate"`
	DueDate     *string                `json:"dueDate"`
	Points      *float64               `json:"points"`
	Estimate    *float64               `json:"estimate"`
	Checklist   []domain.ChecklistItem `json:"checklist"`
	IssueType   string                 `json:"issueType"`
	// EpicRef is the Ref of an epic elsewhere in the same import.
	EpicRef string `json:"epicRef"`
}

type ImportList struct {
	Name  string       `json:"name"`
	Tasks []ImportTask `json:"tasks"`
}

// ImportInput lands in an existing Space (SpaceID) or a new one (SpaceName).
type ImportInput struct {
	Source    string       `json:"source"`
	SpaceID   string       `json:"spaceId"`
	SpaceName string       `json:"spaceName"`
	Lists     []ImportList `json:"lists"`
}

type ImportResult struct {
	SpaceID  string   `json:"spaceId"`
	Lists    int      `json:"lists"`
	Tasks    int      `json:"tasks"`
	Subtasks int      `json:"subtasks"`
	Skipped  []string `json:"skipped"`
}

var statusColors = map[domain.StatusType]string{domain.StatusOpen: "#94a3b8", domain.StatusActive: "#3b82f6", domain.StatusDone: "#10b981", domain.StatusClosed: "#64748b"}

// importStatuses keeps the source tool's own status names, ordered open →
// active → done → closed, and makes sure there is a starting and a finished one.
func importStatuses(lists []ImportList) []domain.Status {
	prefix := uuid.NewString()[:8]
	seen := map[string]bool{}
	byType := map[domain.StatusType][]domain.Status{}
	for _, l := range lists {
		for _, t := range l.Tasks {
			name := strings.TrimSpace(t.Status)
			typ := t.StatusType
			if _, ok := statusColors[typ]; !ok {
				typ = domain.StatusOpen
			}
			if name == "" || seen[strings.ToLower(name)] || len(name) > 40 {
				continue
			}
			seen[strings.ToLower(name)] = true
			byType[typ] = append(byType[typ], domain.Status{ID: fmt.Sprintf("%s-%d", prefix, len(seen)), Name: name, Color: statusColors[typ], Type: typ})
		}
	}
	if len(byType[domain.StatusOpen]) == 0 {
		byType[domain.StatusOpen] = []domain.Status{{ID: prefix + "-todo", Name: "To do", Color: statusColors[domain.StatusOpen], Type: domain.StatusOpen}}
	}
	if len(byType[domain.StatusDone])+len(byType[domain.StatusClosed]) == 0 {
		byType[domain.StatusDone] = []domain.Status{{ID: prefix + "-done", Name: "Complete", Color: statusColors[domain.StatusDone], Type: domain.StatusDone}}
	}
	var out []domain.Status
	for _, typ := range []domain.StatusType{domain.StatusOpen, domain.StatusActive, domain.StatusDone, domain.StatusClosed} {
		out = append(out, byType[typ]...)
	}
	if len(out) > 20 {
		// Too many to keep: fall back to one status per type.
		var short []domain.Status
		for _, typ := range []domain.StatusType{domain.StatusOpen, domain.StatusActive, domain.StatusDone, domain.StatusClosed} {
			if len(byType[typ]) > 0 {
				short = append(short, byType[typ][0])
			}
		}
		out = short
	}
	return out
}

func statusFor(proj *domain.Project, t ImportTask) string {
	name := strings.ToLower(strings.TrimSpace(t.Status))
	for _, st := range proj.Statuses {
		if name != "" && strings.ToLower(st.Name) == name {
			return st.ID
		}
	}
	for _, st := range proj.Statuses {
		if st.Type == t.StatusType {
			return st.ID
		}
	}
	return proj.Statuses[0].ID
}

// Import brings tasks over from another tool. It skips the per-task inbox
// notifications and automations a normal create would trigger.
func (s *Service) Import(ctx context.Context, ws, actorID string, in ImportInput) (*ImportResult, error) {
	if !slices.Contains([]string{"clickup", "jira", "trello", "asana", "csv"}, in.Source) {
		return nil, apperror.Invalid("invalid_source", "unknown import source")
	}
	total := 0
	for _, l := range in.Lists {
		total += len(l.Tasks)
	}
	if total == 0 {
		return nil, apperror.Invalid("empty_import", "there are no tasks to import")
	}
	if total > maxImportTasks || len(in.Lists) > maxImportLists {
		return nil, apperror.Invalid("import_too_large", fmt.Sprintf("import at most %d tasks in %d lists at a time", maxImportTasks, maxImportLists))
	}

	var proj *domain.Project
	var err error
	if in.SpaceID != "" {
		if proj, err = s.repo.GetProject(ctx, ws, in.SpaceID); err != nil {
			return nil, err
		}
	} else {
		name := strings.TrimSpace(in.SpaceName)
		if name == "" {
			name = "Imported"
		}
		if proj, err = s.CreateProject(ctx, ws, "", name, ""); err != nil {
			return nil, err
		}
		proj.Statuses = importStatuses(in.Lists)
		if err := s.repo.UpdateProject(ctx, proj); err != nil {
			return nil, err
		}
		s.emit(ctx, ws, "projects", "upsert", proj)
	}

	// Only real members can be assignees.
	members, err := s.members.MemberIDs(ctx, ws)
	if err != nil {
		return nil, err
	}
	isMember := map[string]bool{}
	for _, m := range members {
		isMember[m] = true
	}
	var createdBy *string
	if actorID != "" {
		createdBy = &actorID
	}
	maxOrder, err := s.repo.MaxOrder(ctx, ws)
	if err != nil {
		return nil, err
	}

	res := &ImportResult{SpaceID: proj.ID, Skipped: []string{}}
	refs := map[string]*domain.Task{}
	var epicLinks [][2]string // task id → epic ref, resolved once every task exists
	create := func(listID string, t ImportTask, parent *domain.Task) error {
		title, err := cleanTitle(t.Title)
		if err != nil {
			res.Skipped = append(res.Skipped, "a task without a usable name")
			return nil
		}
		var assignees []string
		for _, a := range uniq(t.Assignees) {
			if isMember[a] {
				assignees = append(assignees, a)
			}
		}
		if t.Priority != nil && !validPriorities[*t.Priority] {
			t.Priority = nil
		}
		if validDate(t.StartDate) != nil {
			t.StartDate = nil
		}
		if validDate(t.DueDate) != nil {
			t.DueDate = nil
		}
		for i := range t.Checklist {
			if t.Checklist[i].ID == "" {
				t.Checklist[i].ID = uuid.NewString()
			}
		}
		key, err := s.keys.NextTaskKey(ctx, ws)
		if err != nil {
			return err
		}
		maxOrder++
		if !domain.IssueTypes[t.IssueType] {
			t.IssueType = domain.IssueTask
		}
		task := &domain.Task{
			WorkspaceID: ws, Key: key, ListID: listID, Title: title, Description: t.Description, StatusID: statusFor(proj, t),
			Priority: t.Priority, Assignees: assignees, Tags: cleanTags(t.Tags), StartDate: t.StartDate, DueDate: t.DueDate,
			Estimate: t.Estimate, Points: t.Points, Checklist: t.Checklist, Order: maxOrder, CreatedBy: createdBy, IssueType: t.IssueType,
		}
		if parent != nil {
			task.ParentID, task.ListID = &parent.ID, parent.ListID
		}
		if err := s.repo.CreateTask(ctx, task); err != nil {
			return err
		}
		s.emit(ctx, ws, "tasks", "upsert", task)
		if t.Ref != "" {
			refs[t.Ref] = task
		}
		if t.EpicRef != "" && t.IssueType != domain.IssueEpic {
			epicLinks = append(epicLinks, [2]string{task.ID, t.EpicRef})
		}
		if parent != nil {
			res.Subtasks++
		} else {
			res.Tasks++
		}
		return nil
	}

	type pending struct {
		listID string
		task   ImportTask
	}
	var children []pending
	for _, l := range in.Lists {
		name := strings.TrimSpace(l.Name)
		if name == "" {
			name = "Imported tasks"
		}
		if len([]rune(name)) > 120 {
			name = string([]rune(name)[:120])
		}
		list, err := s.CreateList(ctx, ws, "", proj.ID, nil, name)
		if err != nil {
			return nil, err
		}
		res.Lists++
		for _, t := range l.Tasks {
			if t.ParentRef != "" {
				children = append(children, pending{list.ID, t})
				continue
			}
			if err := create(list.ID, t, nil); err != nil {
				return nil, err
			}
		}
	}
	// Subtasks after their parents; deeper levels resolve over a few passes.
	for pass := 0; pass < 5 && len(children) > 0; pass++ {
		var next []pending
		for _, c := range children {
			parent, ok := refs[c.task.ParentRef]
			if !ok {
				next = append(next, c)
				continue
			}
			if err := create(c.listID, c.task, parent); err != nil {
				return nil, err
			}
		}
		children = next
	}
	// Parents that weren't in the file: keep the task, just not as a subtask.
	for _, c := range children {
		c.task.ParentRef = ""
		if err := create(c.listID, c.task, nil); err != nil {
			return nil, err
		}
	}
	for _, link := range epicLinks {
		epic, ok := refs[link[1]]
		if !ok || epic.IssueType != domain.IssueEpic {
			continue
		}
		t, err := s.repo.GetTask(ctx, ws, link[0])
		if err != nil {
			return nil, err
		}
		t.EpicID = &epic.ID
		if err := s.repo.UpdateTask(ctx, t); err != nil {
			return nil, err
		}
		s.emit(ctx, ws, "tasks", "upsert", t)
	}
	return res, nil
}
