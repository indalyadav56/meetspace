package application

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/tasks/domain"
)

type TaskService struct {
	repo  domain.Repository
	teams TeamInfo
	log   *slog.Logger
}

func NewTaskService(repo domain.Repository, teams TeamInfo, log *slog.Logger) *TaskService {
	return &TaskService{repo: repo, teams: teams, log: log}
}

func (s *TaskService) List(ctx context.Context, f domain.ListFilter) ([]domain.Task, error) {
	if f.Status != "" && !f.Status.Valid() {
		return nil, domain.ErrInvalidStatus
	}
	return s.repo.List(ctx, f)
}

func (s *TaskService) Get(ctx context.Context, id string) (*domain.Task, error) {
	return s.repo.FindByID(ctx, id)
}

type CreateTaskInput struct {
	Title       string
	Description string
	Status      domain.Status
	Priority    domain.Priority
	Type        string
	TeamID      string
	AssigneeIDs []string
	Tags        []string
	DueDate     *time.Time
}

func (s *TaskService) Create(ctx context.Context, in CreateTaskInput) (*domain.Task, error) {
	if in.Status == "" {
		in.Status = domain.StatusTodo
	}
	if in.Priority == "" {
		in.Priority = domain.PriorityNone
	}
	if !in.Status.Valid() {
		return nil, domain.ErrInvalidStatus
	}
	if !in.Priority.Valid() {
		return nil, domain.ErrInvalidPriority
	}

	teamKey, err := s.teams.TeamKey(ctx, in.TeamID)
	if err != nil {
		return nil, err
	}
	n, err := s.repo.NextKeyNumber(ctx, in.TeamID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	t := &domain.Task{
		ID:          uuid.NewString(),
		Key:         fmt.Sprintf("%s-%d", teamKey, n),
		Title:       strings.TrimSpace(in.Title),
		Description: in.Description,
		Status:      in.Status,
		Priority:    in.Priority,
		Type:        in.Type,
		TeamID:      in.TeamID,
		AssigneeIDs: in.AssigneeIDs,
		Tags:        in.Tags,
		DueDate:     in.DueDate,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

type UpdateTaskInput struct {
	Title       *string
	Description *string
	Status      *domain.Status
	Priority    *domain.Priority
	Type        *string
	AssigneeIDs *[]string
	Tags        *[]string
	DueDate     *time.Time
	ClearDue    bool
}

func (s *TaskService) Update(ctx context.Context, id string, in UpdateTaskInput) (*domain.Task, error) {
	t, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.Title != nil {
		t.Title = strings.TrimSpace(*in.Title)
	}
	if in.Description != nil {
		t.Description = *in.Description
	}
	if in.Status != nil {
		if !in.Status.Valid() {
			return nil, domain.ErrInvalidStatus
		}
		t.Status = *in.Status
	}
	if in.Priority != nil {
		if !in.Priority.Valid() {
			return nil, domain.ErrInvalidPriority
		}
		t.Priority = *in.Priority
	}
	if in.Type != nil {
		t.Type = *in.Type
	}
	if in.AssigneeIDs != nil {
		t.AssigneeIDs = *in.AssigneeIDs
	}
	if in.Tags != nil {
		t.Tags = *in.Tags
	}
	if in.DueDate != nil {
		t.DueDate = in.DueDate
	}
	if in.ClearDue {
		t.DueDate = nil
	}
	t.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TaskService) Move(ctx context.Context, id string, status domain.Status) (*domain.Task, error) {
	return s.Update(ctx, id, UpdateTaskInput{Status: &status})
}

func (s *TaskService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *TaskService) AddSubtask(ctx context.Context, taskID, title string) (*domain.Task, error) {
	t, err := s.repo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	t.Subtasks = append(t.Subtasks, domain.Subtask{
		ID:    uuid.NewString(),
		Title: strings.TrimSpace(title),
	})
	t.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TaskService) ToggleSubtask(ctx context.Context, taskID, subtaskID string) (*domain.Task, error) {
	t, err := s.repo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	found := false
	for i := range t.Subtasks {
		if t.Subtasks[i].ID == subtaskID {
			t.Subtasks[i].Done = !t.Subtasks[i].Done
			found = true
			break
		}
	}
	if !found {
		return nil, domain.ErrSubtaskNotFound
	}
	t.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *TaskService) AddComment(ctx context.Context, taskID, authorID, body string) (*domain.Task, error) {
	t, err := s.repo.FindByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	t.Comments = append(t.Comments, domain.Comment{
		ID:        uuid.NewString(),
		AuthorID:  authorID,
		Body:      body,
		CreatedAt: time.Now().UTC(),
	})
	t.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}
