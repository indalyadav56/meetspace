// Package domain holds the work context: the project hierarchy, tasks and the
// things attached to them.
package domain

import (
	"encoding/json"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// BotID is the author id clients see for automation comments and activity.
const BotID = "bot"

type StatusType string

const (
	StatusOpen   StatusType = "open"
	StatusActive StatusType = "active"
	StatusDone   StatusType = "done"
	StatusClosed StatusType = "closed"
)

type Status struct {
	ID    string     `json:"id"`
	Name  string     `json:"name"`
	Color string     `json:"color"`
	Type  StatusType `json:"type"`
}

func (s Status) Finished() bool { return s.Type == StatusDone || s.Type == StatusClosed }

type Project struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	Statuses    []Status  `json:"statuses"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (p Project) Status(id string) (Status, bool) {
	for _, s := range p.Statuses {
		if s.ID == id {
			return s, true
		}
	}
	return Status{}, false
}

// FirstOfType returns the first status of type t, or the first status.
func (p Project) FirstOfType(t StatusType) Status {
	for _, s := range p.Statuses {
		if s.Type == t {
			return s
		}
	}
	return p.Statuses[0]
}

// DefaultStatuses are given to new projects. Ids are scoped to the project.
func DefaultStatuses(prefix string) []Status {
	return []Status{
		{ID: prefix + "-todo", Name: "To do", Color: "#94a3b8", Type: StatusOpen},
		{ID: prefix + "-prog", Name: "In progress", Color: "#3b82f6", Type: StatusActive},
		{ID: prefix + "-rev", Name: "In review", Color: "#a855f7", Type: StatusActive},
		{ID: prefix + "-done", Name: "Complete", Color: "#10b981", Type: StatusDone},
	}
}

type Folder struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"-"`
	ProjectID   string `json:"projectId"`
	Name        string `json:"name"`
}

type List struct {
	ID          string  `json:"id"`
	WorkspaceID string  `json:"-"`
	ProjectID   string  `json:"projectId"`
	FolderID    *string `json:"folderId"`
	Name        string  `json:"name"`
}

type ChecklistItem struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Done bool   `json:"done"`
}

type Task struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"-"`
	Key         int64           `json:"key"`
	ListID      string          `json:"listId"`
	ParentID    *string         `json:"parentId"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	StatusID    string          `json:"statusId"`
	Priority    *string         `json:"priority"`
	Assignees   []string        `json:"assignees"`
	Tags        []string        `json:"tags"`
	StartDate   *string         `json:"startDate"`
	DueDate     *string         `json:"dueDate"`
	Estimate    *float64        `json:"estimate"`
	Checklist   []ChecklistItem `json:"checklist"`
	BlockedBy   []string        `json:"blockedBy"`
	Recurrence  *string         `json:"recurrence"`
	Custom      map[string]any  `json:"custom"`
	SprintID    *string         `json:"sprintId"`
	Points      *float64        `json:"points"`
	Watchers    []string        `json:"watchers"`
	ClipIDs     []string        `json:"clipIds"`
	Order       float64         `json:"order"`
	CreatedBy   *string         `json:"createdBy"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

type Comment struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	UserID    string    `json:"userId"`
	Text      string    `json:"text"`
	Assignee  *string   `json:"assignee"`
	Resolved  bool      `json:"resolved"`
	CreatedAt time.Time `json:"createdAt"`
}

type Activity struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	UserID    string    `json:"userId"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
}

type FieldOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type CustomField struct {
	ID      string        `json:"id"`
	ListID  string        `json:"listId"`
	Name    string        `json:"name"`
	Type    string        `json:"type"`
	Options []FieldOption `json:"options"`
}

type TimeEntry struct {
	ID       string    `json:"id"`
	TaskID   string    `json:"taskId"`
	UserID   string    `json:"userId"`
	Start    time.Time `json:"start"`
	Duration int       `json:"duration"`
	Note     string    `json:"note"`
}

type Timer struct {
	TaskID string    `json:"taskId"`
	Start  time.Time `json:"start"`
}

type Sprint struct {
	ID              string   `json:"id"`
	ProjectID       string   `json:"projectId"`
	Name            string   `json:"name"`
	Goal            string   `json:"goal"`
	StartDate       string   `json:"startDate"`
	EndDate         string   `json:"endDate"`
	Status          string   `json:"status"`
	CompletedPoints *float64 `json:"completedPoints,omitempty"`
}

type Trigger struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type Action struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type Automation struct {
	ID        string     `json:"id"`
	ProjectID string     `json:"projectId"`
	Name      string     `json:"name"`
	Enabled   bool       `json:"enabled"`
	Trigger   Trigger    `json:"trigger"`
	Actions   []Action   `json:"actions"`
	Runs      int        `json:"runs"`
	LastRun   *time.Time `json:"lastRun"`
}

type FormField struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	Required bool     `json:"required"`
	Options  []string `json:"options"`
	Target   string   `json:"target"`
	Help     string   `json:"help"`
}

type Form struct {
	ID          string      `json:"id"`
	WorkspaceID string      `json:"-"`
	ListID      string      `json:"listId"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Color       string      `json:"color"`
	Fields      []FormField `json:"fields"`
	AssignTo    []string    `json:"assignTo"`
	SubmitText  string      `json:"submitText"`
	ThanksText  string      `json:"thanksText"`
	Active      bool        `json:"active"`
	Submissions int         `json:"submissions"`
	CreatedAt   time.Time   `json:"createdAt"`
}

// Timesheet is one person's week of tracked time and its approval state.
type Timesheet struct {
	UserID      string     `json:"userId"`
	WeekStart   string     `json:"weekStart"` // Monday, YYYY-MM-DD
	Status      string     `json:"status"`    // open | submitted | approved | rejected
	Note        string     `json:"note"`
	SubmittedAt *time.Time `json:"submittedAt"`
	DecidedBy   *string    `json:"decidedBy"`
	DecidedAt   *time.Time `json:"decidedAt"`
}

// MarshalJSON adds a stable id so clients can treat sheets like other records.
func (t Timesheet) MarshalJSON() ([]byte, error) {
	type plain Timesheet
	return json.Marshal(struct {
		ID string `json:"id"`
		plain
	}{t.UserID + ":" + t.WeekStart, plain(t)})
}

// Locked reports whether the week's entries can no longer be edited.
func (t Timesheet) Locked() bool { return t.Status == "submitted" || t.Status == "approved" }

var (
	ErrProjectNotFound    = apperror.NotFound("project_not_found", "project not found")
	ErrFolderNotFound     = apperror.NotFound("folder_not_found", "folder not found")
	ErrListNotFound       = apperror.NotFound("list_not_found", "list not found")
	ErrTaskNotFound       = apperror.NotFound("task_not_found", "task not found")
	ErrCommentNotFound    = apperror.NotFound("comment_not_found", "comment not found")
	ErrFieldNotFound      = apperror.NotFound("field_not_found", "custom field not found")
	ErrEntryNotFound      = apperror.NotFound("time_entry_not_found", "time entry not found")
	ErrSprintNotFound     = apperror.NotFound("sprint_not_found", "sprint not found")
	ErrAutomationNotFound = apperror.NotFound("automation_not_found", "automation not found")
	ErrFormNotFound       = apperror.NotFound("form_not_found", "form not found")
	ErrNoTimer            = apperror.Conflict("no_timer", "no timer is running")
	ErrTimesheetLocked    = apperror.Conflict("timesheet_locked", "this week’s timesheet is submitted or approved; reopen it to make changes")
	ErrInvalidStatus      = apperror.Invalid("invalid_status", "status does not exist in this project")
	ErrNotMember          = apperror.Invalid("not_a_member", "that person is not a member of this workspace")
	ErrDependencyCycle    = apperror.Conflict("dependency_cycle", "these tasks already depend on each other")
	ErrFormClosed         = apperror.Conflict("form_closed", "this form isn't accepting responses")
)
