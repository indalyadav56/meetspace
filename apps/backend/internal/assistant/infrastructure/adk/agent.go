// Package adk runs the Meetspace assistant on Google's Agent Development Kit
// with a Gemini model. Tools act on the workspace through the WorkspaceTools port.
package adk

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"google.golang.org/adk/agent"
	"google.golang.org/adk/agent/llmagent"
	"google.golang.org/adk/model/gemini"
	"google.golang.org/adk/runner"
	"google.golang.org/adk/session"
	"google.golang.org/adk/tool"
	"google.golang.org/adk/tool/functiontool"
	"google.golang.org/genai"

	"github.com/indalyadav56/meetspace/backend/internal/assistant/application"
)

const appName = "meetspace"

const instruction = `You are Meetspace Assistant, built into Meetspace — a work platform with workspaces, projects, folders, Lists and tasks (subtasks, assignees, priorities, dates, dependencies), Docs, Chat and meetings.

You act on the user's current workspace only, through the tools provided. Look things up with tools rather than guessing; never invent task keys, people or Lists. When asked to change something, do it with the tools and then say briefly what changed. If a request would modify more than five tasks at once, describe the plan and ask for confirmation first.

Each user message starts with a <context> block giving today's date, the user's name and what they are looking at. Resolve relative dates ("Friday", "next week") against it and pass dates as YYYY-MM-DD. "This task" means the task in context.

Write short, scannable answers in Markdown: bold for emphasis, "-" bullets, no tables. Refer to tasks by key and title, e.g. MS-104 Rotate service credentials — the app turns keys into links.`

type ctxKey int

const (
	keyEmit ctxKey = iota
	keyWorkspace
	keyUser
)

// Agent implements application.Agent with ADK.
type Agent struct {
	runner   *runner.Runner
	sessions session.Service
	model    string
}

// New builds the Gemini model, the tools and the runner. sessions persists
// conversations (use session/database for Postgres, InMemoryService for tests).
func New(ctx context.Context, apiKey, modelName string, tools application.WorkspaceTools, sessions session.Service) (*Agent, error) {
	llm, err := gemini.NewModel(ctx, modelName, &genai.ClientConfig{APIKey: apiKey, Backend: genai.BackendGeminiAPI})
	if err != nil {
		return nil, fmt.Errorf("create gemini model: %w", err)
	}
	ts, err := buildTools(tools)
	if err != nil {
		return nil, err
	}
	root, err := llmagent.New(llmagent.Config{
		Name:        "meetspace_assistant",
		Description: "Answers questions about and makes changes in a Meetspace workspace.",
		Model:       llm,
		Instruction: instruction,
		Tools:       ts,
	})
	if err != nil {
		return nil, fmt.Errorf("create agent: %w", err)
	}
	r, err := runner.New(runner.Config{AppName: appName, Agent: root, SessionService: sessions})
	if err != nil {
		return nil, fmt.Errorf("create runner: %w", err)
	}
	return &Agent{runner: r, sessions: sessions, model: modelName}, nil
}

func (a *Agent) Model() string { return a.model }

// ensureSession loads the conversation or creates it bound to one workspace.
func (a *Agent) ensureSession(ctx context.Context, req application.RunRequest) error {
	got, err := a.sessions.Get(ctx, &session.GetRequest{AppName: appName, UserID: req.UserID, SessionID: req.SessionID})
	if err == nil && got != nil && got.Session != nil {
		v, err := got.Session.State().Get("workspace_id")
		if err != nil || v != req.WorkspaceID {
			return errors.New("this conversation belongs to another workspace")
		}
		return nil
	}
	_, err = a.sessions.Create(ctx, &session.CreateRequest{
		AppName: appName, UserID: req.UserID, SessionID: req.SessionID,
		State: map[string]any{"workspace_id": req.WorkspaceID},
	})
	return err
}

func (a *Agent) Run(ctx context.Context, req application.RunRequest, emit func(application.Event)) error {
	if err := a.ensureSession(ctx, req); err != nil {
		return err
	}
	// Tools read the caller's identity and the emitter from the context, never from model output.
	ctx = context.WithValue(ctx, keyEmit, emit)
	ctx = context.WithValue(ctx, keyWorkspace, req.WorkspaceID)
	ctx = context.WithValue(ctx, keyUser, req.UserID)

	msg := genai.NewContentFromText("<context>\n"+req.Context+"\n</context>\n"+req.Message, genai.RoleUser)
	sawPartial := false
	for ev, err := range a.runner.Run(ctx, req.UserID, req.SessionID, msg, agent.RunConfig{StreamingMode: agent.StreamingModeSSE}) {
		if err != nil {
			return err
		}
		if ev == nil || ev.Content == nil {
			continue
		}
		if ev.Partial {
			for _, p := range ev.Content.Parts {
				if p != nil && p.Text != "" && !p.Thought {
					sawPartial = true
					emit(application.Event{Type: "text", Text: p.Text})
				}
			}
			continue
		}
		for _, p := range ev.Content.Parts {
			if p == nil {
				continue
			}
			switch {
			case p.FunctionCall != nil:
				emit(application.Event{Type: "status", Text: statusLabel(p.FunctionCall.Name)})
			case p.Text != "" && !p.Thought && !sawPartial:
				// Non-streamed text (models or turns that didn't stream partials).
				emit(application.Event{Type: "text", Text: p.Text})
			}
		}
		if ev.Content.Role == genai.RoleModel {
			sawPartial = false
		}
	}
	emit(application.Event{Type: "done", SessionID: req.SessionID})
	return nil
}

func statusLabel(tool string) string {
	labels := map[string]string{
		"workspace_overview": "Reviewing the workspace",
		"list_projects":      "Looking at projects",
		"search_tasks":       "Searching tasks",
		"get_task":           "Reading a task",
		"create_task":        "Creating a task",
		"update_task":        "Updating a task",
		"add_comment":        "Posting a comment",
		"get_doc":            "Reading a doc",
		"create_doc":         "Writing a doc",
	}
	if l, ok := labels[tool]; ok {
		return l
	}
	return "Working"
}

// ---- tools

func scope(ctx context.Context) (ws, user string, emit func(application.Event)) {
	ws, _ = ctx.Value(keyWorkspace).(string)
	user, _ = ctx.Value(keyUser).(string)
	emit, _ = ctx.Value(keyEmit).(func(application.Event))
	if emit == nil {
		emit = func(application.Event) {}
	}
	return
}

// result turns a tool outcome into what the model sees and reports effects to the UI.
func result(ctx context.Context, out map[string]any, err error) (map[string]any, error) {
	if err != nil {
		// Return the error as data so the model can recover (e.g. pick a valid List).
		return map[string]any{"error": err.Error()}, nil
	}
	if eff, ok := out["effect"].(map[string]any); ok {
		_, _, emit := scope(ctx)
		e := application.Event{Type: "effect"}
		e.Label, _ = eff["label"].(string)
		e.TaskID, _ = eff["taskId"].(string)
		e.DocID, _ = eff["docId"].(string)
		emit(e)
		delete(out, "effect")
	}
	return out, nil
}

type noArgs struct{}

type searchArgs struct {
	Query    string `json:"query,omitempty" jsonschema:"Text to match in the task title."`
	Assignee string `json:"assignee,omitempty" jsonschema:"A person's name, 'me' for the current user, or 'unassigned'."`
	State    string `json:"state,omitempty" jsonschema:"One of open, in_progress, done, not_done."`
	Due      string `json:"due,omitempty" jsonschema:"One of overdue, today, this_week, no_date."`
	Project  string `json:"project,omitempty" jsonschema:"Project name."`
	List     string `json:"list,omitempty" jsonschema:"List name."`
	Priority string `json:"priority,omitempty" jsonschema:"One of urgent, high, normal, low."`
	Limit    int    `json:"limit,omitempty" jsonschema:"Maximum results (default 20, max 50)."`
}

type taskRef struct {
	Task string `json:"task" jsonschema:"Task key like MS-123, or its title."`
}

type createArgs struct {
	Title       string   `json:"title" jsonschema:"Task title."`
	List        string   `json:"list,omitempty" jsonschema:"List name. Defaults to the List in context, else the first List."`
	Description string   `json:"description,omitempty" jsonschema:"Plain text or Markdown description."`
	Assignees   []string `json:"assignees,omitempty" jsonschema:"People's names, or 'me'."`
	DueDate     string   `json:"due_date,omitempty" jsonschema:"YYYY-MM-DD"`
	StartDate   string   `json:"start_date,omitempty" jsonschema:"YYYY-MM-DD"`
	Priority    string   `json:"priority,omitempty" jsonschema:"One of urgent, high, normal, low."`
	Tags        []string `json:"tags,omitempty"`
	ParentTask  string   `json:"parent_task,omitempty" jsonschema:"Key or title of the parent task, to create a subtask."`
}

type updateArgs struct {
	Task            string   `json:"task" jsonschema:"Task key like MS-123, or its title."`
	Title           string   `json:"title,omitempty"`
	Status          string   `json:"status,omitempty" jsonschema:"Status name in the task's project (e.g. 'In progress'), or 'done'."`
	Priority        string   `json:"priority,omitempty" jsonschema:"One of urgent, high, normal, low, none."`
	DueDate         string   `json:"due_date,omitempty" jsonschema:"YYYY-MM-DD"`
	ClearDueDate    bool     `json:"clear_due_date,omitempty" jsonschema:"Set true to remove the due date."`
	StartDate       string   `json:"start_date,omitempty" jsonschema:"YYYY-MM-DD"`
	AddAssignees    []string `json:"add_assignees,omitempty"`
	RemoveAssignees []string `json:"remove_assignees,omitempty"`
	AddTags         []string `json:"add_tags,omitempty"`
}

type commentArgs struct {
	Task string `json:"task" jsonschema:"Task key like MS-123, or its title."`
	Text string `json:"text" jsonschema:"Comment text."`
}

type docRef struct {
	Doc string `json:"doc" jsonschema:"Doc title."`
}

type createDocArgs struct {
	Title    string `json:"title"`
	Markdown string `json:"markdown" jsonschema:"Body in Markdown: # headings, - bullets, 1. numbered, **bold**, - [ ] checklists."`
	Project  string `json:"project,omitempty" jsonschema:"Optional project name."`
}

func toMap(v any) map[string]any {
	out := map[string]any{}
	switch a := v.(type) {
	case createArgs:
		set(out, "title", a.Title)
		set(out, "list", a.List)
		set(out, "description", a.Description)
		set(out, "due_date", a.DueDate)
		set(out, "start_date", a.StartDate)
		set(out, "priority", a.Priority)
		set(out, "parent_task", a.ParentTask)
		if len(a.Assignees) > 0 {
			out["assignees"] = a.Assignees
		}
		if len(a.Tags) > 0 {
			out["tags"] = a.Tags
		}
	case updateArgs:
		set(out, "task", a.Task)
		set(out, "title", a.Title)
		set(out, "status", a.Status)
		set(out, "priority", a.Priority)
		set(out, "due_date", a.DueDate)
		set(out, "start_date", a.StartDate)
		if a.ClearDueDate {
			out["clear_due_date"] = true
		}
		if len(a.AddAssignees) > 0 {
			out["add_assignees"] = a.AddAssignees
		}
		if len(a.RemoveAssignees) > 0 {
			out["remove_assignees"] = a.RemoveAssignees
		}
		if len(a.AddTags) > 0 {
			out["add_tags"] = a.AddTags
		}
	}
	return out
}

func set(m map[string]any, k, v string) {
	if strings.TrimSpace(v) != "" {
		m[k] = strings.TrimSpace(v)
	}
}

func buildTools(w application.WorkspaceTools) ([]tool.Tool, error) {
	var tools []tool.Tool
	add := func(t tool.Tool, err error) error {
		if err != nil {
			return err
		}
		tools = append(tools, t)
		return nil
	}
	errs := []error{
		add(functiontool.New(functiontool.Config{Name: "workspace_overview", Description: "Snapshot of the workspace: projects, task counts by state, overdue tasks, workload per person and recent activity. Use first for status reports and standups."},
			func(ctx agent.ToolContext, _ noArgs) (map[string]any, error) {
				ws, user, _ := scope(ctx)
				out, err := w.Overview(ctx, ws, user)
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "list_projects", Description: "Every project with its Lists, folders and statuses, plus workspace members. Use to find valid List names."},
			func(ctx agent.ToolContext, _ noArgs) (map[string]any, error) {
				ws, _, _ := scope(ctx)
				out, err := w.ListProjects(ctx, ws)
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "search_tasks", Description: "Find top-level tasks by any combination of optional filters. Returns key (MS-123), status, assignees, dates and priority."},
			func(ctx agent.ToolContext, a searchArgs) (map[string]any, error) {
				ws, user, _ := scope(ctx)
				f := map[string]string{"query": a.Query, "assignee": a.Assignee, "state": a.State, "due": a.Due, "project": a.Project, "list": a.List, "priority": a.Priority}
				out, err := w.SearchTasks(ctx, ws, user, f, a.Limit)
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "get_task", Description: "Full details of one task: description, subtasks, checklist, comments, dependencies and tracked time."},
			func(ctx agent.ToolContext, a taskRef) (map[string]any, error) {
				ws, _, _ := scope(ctx)
				out, err := w.GetTask(ctx, ws, a.Task)
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "create_task", Description: "Create a task, or a subtask when parent_task is given. Returns the new task key."},
			func(ctx agent.ToolContext, a createArgs) (map[string]any, error) {
				ws, user, _ := scope(ctx)
				out, err := w.CreateTask(ctx, ws, user, toMap(a))
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "update_task", Description: "Change fields on an existing task. Only pass the fields to change."},
			func(ctx agent.ToolContext, a updateArgs) (map[string]any, error) {
				ws, user, _ := scope(ctx)
				out, err := w.UpdateTask(ctx, ws, user, toMap(a))
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "add_comment", Description: "Post a comment on a task on the user's behalf."},
			func(ctx agent.ToolContext, a commentArgs) (map[string]any, error) {
				ws, user, _ := scope(ctx)
				out, err := w.AddComment(ctx, ws, user, a.Task, a.Text)
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "get_doc", Description: "Read a Doc's text by title."},
			func(ctx agent.ToolContext, a docRef) (map[string]any, error) {
				ws, _, _ := scope(ctx)
				out, err := w.GetDoc(ctx, ws, a.Doc)
				return result(ctx, out, err)
			})),
		add(functiontool.New(functiontool.Config{Name: "create_doc", Description: "Create a new Doc from Markdown."},
			func(ctx agent.ToolContext, a createDocArgs) (map[string]any, error) {
				ws, user, _ := scope(ctx)
				out, err := w.CreateDoc(ctx, ws, user, a.Title, a.Markdown, a.Project)
				return result(ctx, out, err)
			})),
	}
	if err := errors.Join(errs...); err != nil {
		return nil, fmt.Errorf("build assistant tools: %w", err)
	}
	return tools, nil
}
