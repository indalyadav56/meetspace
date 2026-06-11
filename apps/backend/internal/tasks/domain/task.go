package domain

import "time"

type Status string

const (
	StatusBacklog    Status = "backlog"
	StatusTodo       Status = "todo"
	StatusInProgress Status = "in_progress"
	StatusInReview   Status = "in_review"
	StatusDone       Status = "done"
)

func (s Status) Valid() bool {
	switch s {
	case StatusBacklog, StatusTodo, StatusInProgress, StatusInReview, StatusDone:
		return true
	}
	return false
}

type Priority string

const (
	PriorityUrgent Priority = "urgent"
	PriorityHigh   Priority = "high"
	PriorityMedium Priority = "medium"
	PriorityLow    Priority = "low"
	PriorityNone   Priority = "none"
)

func (p Priority) Valid() bool {
	switch p {
	case PriorityUrgent, PriorityHigh, PriorityMedium, PriorityLow, PriorityNone:
		return true
	}
	return false
}

type Subtask struct {
	ID    string
	Title string
	Done  bool
}

type Comment struct {
	ID        string
	AuthorID  string
	Body      string
	CreatedAt time.Time
}

type Task struct {
	ID          string
	Key         string // human identifier, e.g. ENG-128
	Title       string
	Description string
	Status      Status
	Priority    Priority
	Type        string
	TeamID      string
	AssigneeIDs []string
	Tags        []string
	DueDate     *time.Time
	Subtasks    []Subtask
	Comments    []Comment
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
