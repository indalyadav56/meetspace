package v1

import (
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/tasks/domain"
)

type SubtaskResponse struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Done  bool   `json:"done"`
}

type CommentResponse struct {
	ID        string    `json:"id"`
	AuthorID  string    `json:"authorId"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

type TaskResponse struct {
	ID          string            `json:"id"`
	Key         string            `json:"key"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Status      string            `json:"status"`
	Priority    string            `json:"priority"`
	Type        string            `json:"type,omitempty"`
	TeamID      string            `json:"teamId"`
	AssigneeIDs []string          `json:"assigneeIds"`
	Tags        []string          `json:"tags"`
	DueDate     *string           `json:"dueDate"`
	Subtasks    []SubtaskResponse `json:"subtasks"`
	Comments    []CommentResponse `json:"comments"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

func toTaskResponse(t *domain.Task) TaskResponse {
	resp := TaskResponse{
		ID:          t.ID,
		Key:         t.Key,
		Title:       t.Title,
		Description: t.Description,
		Status:      string(t.Status),
		Priority:    string(t.Priority),
		Type:        t.Type,
		TeamID:      t.TeamID,
		AssigneeIDs: t.AssigneeIDs,
		Tags:        t.Tags,
		Subtasks:    []SubtaskResponse{},
		Comments:    []CommentResponse{},
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
	if t.DueDate != nil {
		s := t.DueDate.Format("2006-01-02")
		resp.DueDate = &s
	}
	for _, st := range t.Subtasks {
		resp.Subtasks = append(resp.Subtasks, SubtaskResponse(st))
	}
	for _, cm := range t.Comments {
		resp.Comments = append(resp.Comments, CommentResponse(cm))
	}
	return resp
}

type CreateTaskRequest struct {
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	Priority    string   `json:"priority"`
	Type        string   `json:"type"`
	TeamID      string   `json:"teamId" binding:"required"`
	AssigneeIDs []string `json:"assigneeIds"`
	Tags        []string `json:"tags"`
	DueDate     *string  `json:"dueDate"` // YYYY-MM-DD
}

type UpdateTaskRequest struct {
	Title       *string   `json:"title"`
	Description *string   `json:"description"`
	Status      *string   `json:"status"`
	Priority    *string   `json:"priority"`
	Type        *string   `json:"type"`
	AssigneeIDs *[]string `json:"assigneeIds"`
	Tags        *[]string `json:"tags"`
	DueDate     *string   `json:"dueDate"` // YYYY-MM-DD; explicit "" clears it
}

type MoveTaskRequest struct {
	Status string `json:"status" binding:"required"`
}

type AddSubtaskRequest struct {
	Title string `json:"title" binding:"required"`
}

type AddCommentRequest struct {
	AuthorID string `json:"authorId" binding:"required"`
	Body     string `json:"body" binding:"required"`
}
