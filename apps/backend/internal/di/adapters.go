package di

import (
	"context"
	"sort"
	"strings"
	"time"

	"go.uber.org/zap"

	identityapp "github.com/indalyadav56/meetspace/backend/internal/identity/application"
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
		out[i] = map[string]any{"id": p.ID, "name": p.Name, "email": p.Email, "color": p.Color}
	}
	return out, nil
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
