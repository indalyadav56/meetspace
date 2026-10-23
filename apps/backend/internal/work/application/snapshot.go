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
