package domain

import (
	"context"
	"time"
)

// Repository persists the work context. Every method is scoped by workspace so
// one tenant can never read or write another's rows.
type Repository interface {
	// Projects, folders, lists
	CreateProject(ctx context.Context, p *Project) error
	GetProject(ctx context.Context, workspaceID, id string) (*Project, error)
	ListProjects(ctx context.Context, workspaceID string) ([]Project, error)
	UpdateProject(ctx context.Context, p *Project) error
	DeleteProject(ctx context.Context, workspaceID, id string) error

	CreateFolder(ctx context.Context, f *Folder) error
	GetFolder(ctx context.Context, workspaceID, id string) (*Folder, error)
	ListFolders(ctx context.Context, workspaceID string) ([]Folder, error)
	UpdateFolder(ctx context.Context, f *Folder) error
	DeleteFolder(ctx context.Context, workspaceID, id string) error

	CreateList(ctx context.Context, l *List) error
	GetList(ctx context.Context, workspaceID, id string) (*List, error)
	ListLists(ctx context.Context, workspaceID string) ([]List, error)
	UpdateList(ctx context.Context, l *List) error
	DeleteList(ctx context.Context, workspaceID, id string) error

	// Tasks
	CreateTask(ctx context.Context, t *Task) error
	GetTask(ctx context.Context, workspaceID, id string) (*Task, error)
	GetTaskByKey(ctx context.Context, workspaceID string, key int64) (*Task, error)
	ListTasks(ctx context.Context, workspaceID string) ([]Task, error)
	UpdateTask(ctx context.Context, t *Task) error
	// DeleteTask moves the task and its subtasks to the trash and returns every affected id.
	DeleteTask(ctx context.Context, workspaceID, id, actorID string) ([]string, error)
	RestoreTask(ctx context.Context, workspaceID, id string) ([]Task, error)
	PurgeTask(ctx context.Context, workspaceID, id string) ([]string, error)
	ListTrash(ctx context.Context, workspaceID string) ([]TrashedTask, error)
	SetProjectAccess(ctx context.Context, workspaceID, id string, private bool, members []string) error
	InboxToken(ctx context.Context, workspaceID, listID string) (string, error)
	SaveInbox(ctx context.Context, workspaceID, listID, actor, token string) error
	DeleteInbox(ctx context.Context, workspaceID, listID string) error
	InboxByToken(ctx context.Context, token string) (workspaceID, listID string, err error)
	// UnlinkEpic detaches every task from an epic and returns their ids.
	UnlinkEpic(ctx context.Context, workspaceID, epicID string) ([]string, error)
	// RemoveFromBlockedBy strips deleted ids from other tasks' dependencies and returns the changed tasks.
	RemoveFromBlockedBy(ctx context.Context, workspaceID string, ids []string) ([]Task, error)
	MaxOrder(ctx context.Context, workspaceID string) (float64, error)

	// Comments & activity
	CreateComment(ctx context.Context, workspaceID string, c *Comment) error
	GetComment(ctx context.Context, workspaceID, id string) (*Comment, error)
	UpdateComment(ctx context.Context, workspaceID string, c *Comment) error
	ListComments(ctx context.Context, workspaceID string) ([]Comment, error)
	CreateActivity(ctx context.Context, workspaceID string, a *Activity) error
	ListActivity(ctx context.Context, workspaceID string, limit int) ([]Activity, error)

	// Custom fields
	CreateField(ctx context.Context, workspaceID string, f *CustomField) error
	GetField(ctx context.Context, workspaceID, id string) (*CustomField, error)
	ListFields(ctx context.Context, workspaceID string) ([]CustomField, error)
	UpdateField(ctx context.Context, workspaceID string, f *CustomField) error
	DeleteField(ctx context.Context, workspaceID, id string) error
	// RemoveCustomValue deletes a field's values from every task and returns the changed tasks.
	RemoveCustomValue(ctx context.Context, workspaceID, fieldID string) ([]Task, error)

	// Time tracking
	CreateTimeEntry(ctx context.Context, workspaceID string, e *TimeEntry) error
	GetTimeEntry(ctx context.Context, workspaceID, id string) (*TimeEntry, error)
	UpdateTimeEntry(ctx context.Context, workspaceID string, e *TimeEntry) error
	DeleteTimeEntry(ctx context.Context, workspaceID, id string) error
	ListTimeEntries(ctx context.Context, workspaceID string) ([]TimeEntry, error)

	GetTimesheet(ctx context.Context, workspaceID, userID, weekStart string) (*Timesheet, error) // nil when not acted on yet
	SaveTimesheet(ctx context.Context, workspaceID string, t *Timesheet) error
	ListTimesheets(ctx context.Context, workspaceID string) ([]Timesheet, error)
	GetTimer(ctx context.Context, workspaceID, userID string) (*Timer, error)
	SetTimer(ctx context.Context, workspaceID, userID string, t Timer) error
	DeleteTimer(ctx context.Context, workspaceID, userID string) error

	// Sprints
	CreateSprint(ctx context.Context, workspaceID string, s *Sprint) error
	GetSprint(ctx context.Context, workspaceID, id string) (*Sprint, error)
	ListSprints(ctx context.Context, workspaceID string) ([]Sprint, error)
	UpdateSprint(ctx context.Context, workspaceID string, s *Sprint) error
	DeleteSprint(ctx context.Context, workspaceID, id string) error

	// Automations
	CreateAutomation(ctx context.Context, workspaceID string, a *Automation) error
	GetAutomation(ctx context.Context, workspaceID, id string) (*Automation, error)
	ListAutomations(ctx context.Context, workspaceID string) ([]Automation, error)
	UpdateAutomation(ctx context.Context, workspaceID string, a *Automation) error
	DeleteAutomation(ctx context.Context, workspaceID, id string) error
	RecordAutomationRun(ctx context.Context, workspaceID, id string, at time.Time) (*Automation, error)

	// Forms
	CreateForm(ctx context.Context, f *Form) error
	GetForm(ctx context.Context, workspaceID, id string) (*Form, error)
	// GetFormPublic loads a form by id alone, for the unauthenticated share link.
	GetFormPublic(ctx context.Context, id string) (*Form, error)
	ListForms(ctx context.Context, workspaceID string) ([]Form, error)
	UpdateForm(ctx context.Context, f *Form) error
	DeleteForm(ctx context.Context, workspaceID, id string) error
	IncrementSubmissions(ctx context.Context, workspaceID, id string) (*Form, error)
}
