package application

import (
	"context"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

// State is the full work read model of a workspace.
type State struct {
	Projects    []domain.Project
	Folders     []domain.Folder
	Lists       []domain.List
	Tasks       []domain.Task
	Comments    []domain.Comment
	Activity    []domain.Activity
	Fields      []domain.CustomField
	TimeEntries []domain.TimeEntry
	Sprints     []domain.Sprint
	Automations []domain.Automation
	Forms       []domain.Form
}

// activityLimit caps how much history is sent on load; older lines stay in the database.
const activityLimit = 3000

func (s *Service) State(ctx context.Context, ws string) (*State, error) {
	var st State
	var err error
	if st.Projects, err = s.repo.ListProjects(ctx, ws); err != nil {
		return nil, err
	}
	if st.Folders, err = s.repo.ListFolders(ctx, ws); err != nil {
		return nil, err
	}
	if st.Lists, err = s.repo.ListLists(ctx, ws); err != nil {
		return nil, err
	}
	if st.Tasks, err = s.repo.ListTasks(ctx, ws); err != nil {
		return nil, err
	}
	if st.Comments, err = s.repo.ListComments(ctx, ws); err != nil {
		return nil, err
	}
	if st.Activity, err = s.repo.ListActivity(ctx, ws, activityLimit); err != nil {
		return nil, err
	}
	if st.Fields, err = s.repo.ListFields(ctx, ws); err != nil {
		return nil, err
	}
	if st.TimeEntries, err = s.repo.ListTimeEntries(ctx, ws); err != nil {
		return nil, err
	}
	if st.Sprints, err = s.repo.ListSprints(ctx, ws); err != nil {
		return nil, err
	}
	if st.Automations, err = s.repo.ListAutomations(ctx, ws); err != nil {
		return nil, err
	}
	if st.Forms, err = s.repo.ListForms(ctx, ws); err != nil {
		return nil, err
	}
	return &st, nil
}

// filterState drops every Space in hidden and everything inside it.
func filterState(st *State, hidden map[string]bool) {
	var projects []domain.Project
	for _, p := range st.Projects {
		if !hidden[p.ID] {
			projects = append(projects, p)
		}
	}
	st.Projects = projects
	var folders []domain.Folder
	for _, f := range st.Folders {
		if !hidden[f.ProjectID] {
			folders = append(folders, f)
		}
	}
	st.Folders = folders

	visibleList := map[string]bool{}
	var lists []domain.List
	for _, l := range st.Lists {
		if !hidden[l.ProjectID] {
			visibleList[l.ID] = true
			lists = append(lists, l)
		}
	}
	st.Lists = lists

	visibleTask := map[string]bool{}
	var tasks []domain.Task
	for _, t := range st.Tasks {
		if visibleList[t.ListID] {
			visibleTask[t.ID] = true
			tasks = append(tasks, t)
		}
	}
	st.Tasks = tasks

	var comments []domain.Comment
	for _, c := range st.Comments {
		if visibleTask[c.TaskID] {
			comments = append(comments, c)
		}
	}
	st.Comments = comments
	var activity []domain.Activity
	for _, a := range st.Activity {
		if visibleTask[a.TaskID] {
			activity = append(activity, a)
		}
	}
	st.Activity = activity
	var entries []domain.TimeEntry
	for _, e := range st.TimeEntries {
		if visibleTask[e.TaskID] {
			entries = append(entries, e)
		}
	}
	st.TimeEntries = entries
	var fields []domain.CustomField
	for _, f := range st.Fields {
		if visibleList[f.ListID] {
			fields = append(fields, f)
		}
	}
	st.Fields = fields
	var sprints []domain.Sprint
	for _, sp := range st.Sprints {
		if !hidden[sp.ProjectID] {
			sprints = append(sprints, sp)
		}
	}
	st.Sprints = sprints
	var autos []domain.Automation
	for _, a := range st.Automations {
		if !hidden[a.ProjectID] {
			autos = append(autos, a)
		}
	}
	st.Automations = autos
	var forms []domain.Form
	for _, f := range st.Forms {
		if visibleList[f.ListID] {
			forms = append(forms, f)
		}
	}
	st.Forms = forms
}

func nonNil[T any](xs []T) []T {
	if xs == nil {
		return []T{}
	}
	return xs
}

// Snapshot satisfies the snapshot aggregator: collections keyed by client store name.
func (s *Service) Snapshot(ctx context.Context, ws, userID string) (map[string]any, error) {
	st, err := s.State(ctx, ws)
	if err != nil {
		return nil, err
	}
	timer, err := s.repo.GetTimer(ctx, ws, userID)
	if err != nil {
		return nil, err
	}
	sheets, err := s.repo.ListTimesheets(ctx, ws)
	if err != nil {
		return nil, err
	}
	hidden, err := s.HiddenProjects(ctx, ws, userID)
	if err != nil {
		return nil, err
	}
	if len(hidden) > 0 {
		filterState(st, hidden)
	}
	return map[string]any{
		"projects":    nonNil(st.Projects),
		"folders":     nonNil(st.Folders),
		"lists":       nonNil(st.Lists),
		"tasks":       nonNil(st.Tasks),
		"comments":    nonNil(st.Comments),
		"activity":    nonNil(st.Activity),
		"fields":      nonNil(st.Fields),
		"timeEntries": nonNil(st.TimeEntries),
		"timer":       timer,
		"sprints":     nonNil(st.Sprints),
		"automations": nonNil(st.Automations),
		"forms":       nonNil(st.Forms),
		"timesheets":  sheets,
	}, nil
}

// FindTaskByKey resolves MS-123 style references.
func (s *Service) FindTaskByKey(ctx context.Context, ws string, key int64) (*domain.Task, error) {
	return s.repo.GetTaskByKey(ctx, ws, key)
}

// AttachClip links a recorded clip to a task.
func (s *Service) AttachClip(ctx context.Context, ws, taskID, clipID string) error {
	t, err := s.repo.GetTask(ctx, ws, taskID)
	if err != nil {
		return err
	}
	if contains(t.ClipIDs, clipID) {
		return nil
	}
	t.ClipIDs = append(t.ClipIDs, clipID)
	if err := s.repo.UpdateTask(ctx, t); err != nil {
		return err
	}
	s.emit(ctx, ws, "tasks", "upsert", t)
	return nil
}

// PublicList is a read-only view of one List for a share link: tasks, statuses
// and people's names, but no emails, comments or activity.
func (s *Service) PublicList(ctx context.Context, ws, id string) (map[string]any, error) {
	l, err := s.repo.GetList(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	p, err := s.repo.GetProject(ctx, ws, l.ProjectID)
	if err != nil {
		return nil, err
	}
	all, err := s.repo.ListTasks(ctx, ws)
	if err != nil {
		return nil, err
	}
	people := map[string]string{}
	tasks := []map[string]any{}
	for _, t := range all {
		if t.ListID != l.ID {
			continue
		}
		for _, a := range t.Assignees {
			if _, ok := people[a]; !ok {
				people[a] = s.names.DisplayName(ctx, a)
			}
		}
		tasks = append(tasks, map[string]any{
			"id": t.ID, "key": t.Key, "title": t.Title, "statusId": t.StatusID, "priority": t.Priority, "assignees": t.Assignees,
			"tags": t.Tags, "startDate": t.StartDate, "dueDate": t.DueDate, "points": t.Points, "parentId": t.ParentID, "issueType": t.IssueType,
		})
	}
	return map[string]any{"title": l.Name, "space": p.Name, "color": p.Color, "statuses": p.Statuses, "tasks": tasks, "people": people}, nil
}

// AssignedOpen lists the user's unfinished tasks that have a due date, in
// Spaces they can see, with each task's List name.
func (s *Service) AssignedOpen(ctx context.Context, ws, user string) ([]domain.Task, map[string]string, error) {
	hidden, err := s.HiddenProjects(ctx, ws, user)
	if err != nil {
		return nil, nil, err
	}
	projects, err := s.repo.ListProjects(ctx, ws)
	if err != nil {
		return nil, nil, err
	}
	lists, err := s.repo.ListLists(ctx, ws)
	if err != nil {
		return nil, nil, err
	}
	all, err := s.repo.ListTasks(ctx, ws)
	if err != nil {
		return nil, nil, err
	}
	byID := map[string]domain.Project{}
	for _, p := range projects {
		byID[p.ID] = p
	}
	listName, listProj := map[string]string{}, map[string]string{}
	for _, l := range lists {
		listName[l.ID], listProj[l.ID] = l.Name, l.ProjectID
	}
	var out []domain.Task
	for _, t := range all {
		pid := listProj[t.ListID]
		if t.DueDate == nil || hidden[pid] || !contains(t.Assignees, user) {
			continue
		}
		if st, ok := byID[pid].Status(t.StatusID); ok && st.Finished() {
			continue
		}
		out = append(out, t)
	}
	return out, listName, nil
}
