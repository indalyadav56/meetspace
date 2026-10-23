// Package application implements the AI assistant use case. It is model- and
// framework-agnostic: the agent runtime (Google ADK) lives in infrastructure.
package application

import "context"

// WorkspaceTools is everything the assistant may read or change. Arguments and
// results are JSON-shaped maps so tool schemas stay independent of other contexts.
type WorkspaceTools interface {
	Overview(ctx context.Context, workspaceID, userID string) (map[string]any, error)
	ListProjects(ctx context.Context, workspaceID string) (map[string]any, error)
	SearchTasks(ctx context.Context, workspaceID, userID string, filter map[string]string, limit int) (map[string]any, error)
	GetTask(ctx context.Context, workspaceID, ref string) (map[string]any, error)
	CreateTask(ctx context.Context, workspaceID, userID string, args map[string]any) (map[string]any, error)
	UpdateTask(ctx context.Context, workspaceID, userID string, args map[string]any) (map[string]any, error)
	AddComment(ctx context.Context, workspaceID, userID, ref, text string) (map[string]any, error)
	GetDoc(ctx context.Context, workspaceID, title string) (map[string]any, error)
	CreateDoc(ctx context.Context, workspaceID, userID, title, markdown, project string) (map[string]any, error)
}

// Event is streamed to the client while the agent works.
type Event struct {
	Type string `json:"type"` // text | status | effect | done | error
	Text string `json:"text,omitempty"`
	// Effect metadata: what changed, so the UI can link to it.
	Label  string `json:"label,omitempty"`
	TaskID string `json:"taskId,omitempty"`
	DocID  string `json:"docId,omitempty"`
	// SessionID identifies the conversation for follow-up turns.
	SessionID string `json:"sessionId,omitempty"`
}

type RunRequest struct {
	WorkspaceID string
	UserID      string
	SessionID   string
	Message     string
	// Context describes what the user is looking at (date, open task, page).
	Context string
}

// Agent runs one conversational turn and streams events through emit.
type Agent interface {
	Run(ctx context.Context, req RunRequest, emit func(Event)) error
	Model() string
}
