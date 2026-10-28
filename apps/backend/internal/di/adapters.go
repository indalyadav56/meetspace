package di

import (
	"context"
	"slices"
	"sort"
	"strings"
	"time"

	"go.uber.org/zap"

	calapp "github.com/indalyadav56/meetspace/backend/internal/calfeed/application"
	docsapp "github.com/indalyadav56/meetspace/backend/internal/docs/application"
	docsws "github.com/indalyadav56/meetspace/backend/internal/docs/transport/ws"
	meetapp "github.com/indalyadav56/meetspace/backend/internal/meet/application"
	identityapp "github.com/indalyadav56/meetspace/backend/internal/identity/application"
	shareapp "github.com/indalyadav56/meetspace/backend/internal/share/application"
	workapp "github.com/indalyadav56/meetspace/backend/internal/work/application"
	workspaceapp "github.com/indalyadav56/meetspace/backend/internal/workspace/application"
)

// The composition root is the only place that knows several bounded contexts.
// These small adapters translate between their ports.

// userDirectory adapts identity profiles to the workspace and work contexts.
type userDirectory struct{ users *identityapp.UserService }

func (d userDirectory) ProfilesMap(ctx context.Context, ids []string) ([]map[string]any, error) {
	ps, err := d.users.Profiles(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, len(ps))
	for i, p := range ps {
		out[i] = profileMap(p)
	}
	return out, nil
}

func profileMap(p identityapp.Profile) map[string]any {
	m := map[string]any{"id": p.ID, "name": p.Name, "email": p.Email, "color": p.Color}
	if p.Status != nil {
		m["status"] = p.Status
	}
	return m
}

func (d userDirectory) DisplayName(ctx context.Context, id string) string {
	ps, err := d.users.Profiles(ctx, []string{id})
	if err != nil || len(ps) == 0 {
		return "someone"
	}
	return ps[0].Name
}

// mentionResolver finds "@Full Name" mentions of workspace members.
type mentionResolver struct {
	workspaces *workspaceapp.Service
	users      *identityapp.UserService
}

func (m mentionResolver) Mentioned(ctx context.Context, ws, text string) []string {
	if !strings.Contains(text, "@") {
		return nil
	}
	ids, err := m.workspaces.MemberIDs(ctx, ws)
	if err != nil {
		return nil
	}
	ps, err := m.users.Profiles(ctx, ids)
	if err != nil {
		return nil
	}
	// Longest names first so "@Ann Lee" wins over "@Ann".
	sort.Slice(ps, func(i, j int) bool { return len(ps[i].Name) > len(ps[j].Name) })
	var out []string
	for _, p := range ps {
		if strings.Contains(text, "@"+p.Name) {
			out = append(out, p.ID)
		}
	}
	return out
}

// taskFromText lets chat create tasks without importing the work context.
type taskFromText struct{ work *workapp.Service }

func (t taskFromText) CreateTaskFromText(ctx context.Context, ws, actorID, taskID, listID, title, description string) (string, error) {
	task, err := t.work.CreateTask(ctx, ws, actorID, workapp.TaskInput{
		ID: taskID, ListID: listID, Title: title, Description: "<p>" + htmlEscape(description) + "</p>", Assignees: []string{actorID},
	})
	if err != nil {
		return "", err
	}
	return task.ID, nil
}

func htmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

// SnapshotProvider is implemented by every context that contributes to the initial load.
type SnapshotProvider interface {
	Snapshot(ctx context.Context, workspaceID, userID string) (map[string]any, error)
}

// snapshot merges every context's collections into one response.
type snapshot struct{ providers []SnapshotProvider }

func (s snapshot) Snapshot(ctx context.Context, ws, userID string) (map[string]any, error) {
	out := map[string]any{}
	for _, p := range s.providers {
		part, err := p.Snapshot(ctx, ws, userID)
		if err != nil {
			return nil, err
		}
		for k, v := range part {
			out[k] = v
		}
	}
	return out, nil
}

// inviteMailer emails people added to a workspace (best effort: failures are logged).
type inviteMailer struct {
	auth  *identityapp.AuthService
	names userDirectory
	log   *zap.Logger
}

func (m inviteMailer) NotifyInvite(ctx context.Context, email, inviterID, workspaceName string) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := m.auth.SendInvite(ctx, email, m.names.DisplayName(ctx, inviterID), workspaceName); err != nil {
		m.log.Warn("invite email failed", zap.String("to", email), zap.Error(err))
	}
}

// Share link content, one adapter per kind of item.
type docContent struct{ docs *docsapp.Service }

func (c docContent) Public(ctx context.Context, ws, id string) (map[string]any, error) {
	d, err := c.docs.GetDoc(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"title": d.Title, "emoji": d.Emoji, "content": d.Content, "updatedAt": d.UpdatedAt}, nil
}

type whiteboardContent struct{ docs *docsapp.Service }

func (c whiteboardContent) Public(ctx context.Context, ws, id string) (map[string]any, error) {
	b, err := c.docs.GetWhiteboard(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"title": b.Title, "items": b.Items, "updatedAt": b.UpdatedAt}, nil
}

type listContent struct{ work *workapp.Service }

func (c listContent) Public(ctx context.Context, ws, id string) (map[string]any, error) {
	return c.work.PublicList(ctx, ws, id)
}

// shareAccess lets someone share only what they can see: Lists and Docs in
// private Spaces follow Space access.
func shareAccess(work *workapp.Service, docs *docsapp.Service) shareapp.Access {
	return func(ctx context.Context, ws, user, kind, id string) error {
		switch kind {
		case "list":
			return work.CanAccess(ctx, ws, user, "list", id)
		case "doc":
			d, err := docs.GetDoc(ctx, ws, id)
			if err != nil {
				return err
			}
			if d.ProjectID != nil {
				return work.CanAccess(ctx, ws, user, "project", *d.ProjectID)
			}
		}
		return nil
	}
}

// calSource feeds personal calendars from the work and meet contexts.
type calSource struct {
	work *workapp.Service
	meet *meetapp.Service
	ws   *workspaceapp.Service
}

func (c calSource) OpenTasks(ctx context.Context, ws, user string) ([]calapp.TaskItem, error) {
	tasks, lists, err := c.work.AssignedOpen(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	out := make([]calapp.TaskItem, 0, len(tasks))
	for _, t := range tasks {
		it := calapp.TaskItem{ID: t.ID, Key: t.Key, Title: t.Title, List: lists[t.ListID], Due: *t.DueDate, UpdatedAt: t.UpdatedAt}
		if t.StartDate != nil {
			it.Start = *t.StartDate
		}
		out = append(out, it)
	}
	return out, nil
}

func (c calSource) Meetings(ctx context.Context, ws, user string) ([]calapp.MeetingItem, error) {
	ms, err := c.meet.Meetings(ctx, ws)
	if err != nil {
		return nil, err
	}
	var out []calapp.MeetingItem
	for _, m := range ms {
		if m.CreatedBy != user && !slices.Contains(m.Attendees, user) {
			continue
		}
		out = append(out, calapp.MeetingItem{ID: m.ID, Title: m.Title, Agenda: m.Agenda, Start: m.Start, DurationMin: m.DurationMin})
	}
	return out, nil
}

func (c calSource) WorkspaceName(ctx context.Context, ws string) string { return c.ws.Name(ctx, ws) }

// docCollabAccess lets members open Docs they can see; guests watch but don't edit.
func docCollabAccess(docs *docsapp.Service, work *workapp.Service, ws *workspaceapp.Service) docsws.Access {
	return func(ctx context.Context, wid, user, docID string) (bool, error) {
		d, err := docs.GetDoc(ctx, wid, docID)
		if err != nil {
			return false, err
		}
		if d.ProjectID != nil {
			if err := work.CanAccess(ctx, wid, user, "project", *d.ProjectID); err != nil {
				return false, err
			}
		}
		role, err := ws.Role(ctx, wid, user)
		if err != nil {
			return false, err
		}
		return string(role) != "guest", nil
	}
}
