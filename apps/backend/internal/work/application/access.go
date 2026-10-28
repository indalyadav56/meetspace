package application

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

/*
 * Who can see which Space:
 *   owners and admins — every Space;
 *   members           — open Spaces, plus private Spaces they've been added to;
 *   guests            — only Spaces they've been added to.
 * Everything inside a Space (folders, Lists, tasks, comments…) follows it.
 */

// viewer is one person's access within a workspace.
type viewer struct {
	user  string
	all   bool
	guest bool
}

func (v viewer) sees(p *domain.Project) bool {
	if v.all {
		return true
	}
	member := slices.Contains(p.Members, v.user)
	if v.guest {
		return member
	}
	return !p.Private || member
}

func viewerFor(user, role string) viewer {
	return viewer{user: user, all: role == "owner" || role == "admin", guest: role == "guest"}
}

// accessSnapshot caches a workspace's roles and Space access for a few seconds,
// so publishing a burst of changes doesn't re-query them each time.
type accessSnapshot struct {
	at         time.Time
	roles      map[string]string
	projects   map[string]*domain.Project
	listToProj map[string]string
	restricted bool // any private Space or any guest
}

const accessTTL = 3 * time.Second

var accessCache sync.Map // workspace id → *accessSnapshot

func (s *Service) access(ctx context.Context, ws string) (*accessSnapshot, error) {
	if v, ok := accessCache.Load(ws); ok && time.Since(v.(*accessSnapshot).at) < accessTTL {
		return v.(*accessSnapshot), nil
	}
	roles, err := s.members.Roles(ctx, ws)
	if err != nil {
		return nil, err
	}
	projects, err := s.repo.ListProjects(ctx, ws)
	if err != nil {
		return nil, err
	}
	lists, err := s.repo.ListLists(ctx, ws)
	if err != nil {
		return nil, err
	}
	a := &accessSnapshot{at: time.Now(), roles: roles, projects: map[string]*domain.Project{}, listToProj: map[string]string{}}
	for i := range projects {
		a.projects[projects[i].ID] = &projects[i]
		a.restricted = a.restricted || projects[i].Private
	}
	for _, l := range lists {
		a.listToProj[l.ID] = l.ProjectID
	}
	for _, r := range roles {
		a.restricted = a.restricted || r == "guest"
	}
	accessCache.Store(ws, a)
	return a, nil
}

// forgetAccess drops the cache after Space access or membership changes.
func forgetAccess(ws string) { accessCache.Delete(ws) }

// HiddenProjects lists the Spaces user can't see (empty for owners and admins).
func (s *Service) HiddenProjects(ctx context.Context, ws, user string) (map[string]bool, error) {
	a, err := s.access(ctx, ws)
	if err != nil {
		return nil, err
	}
	v := viewerFor(user, a.roles[user])
	hidden := map[string]bool{}
	for id, p := range a.projects {
		if !v.sees(p) {
			hidden[id] = true
		}
	}
	return hidden, nil
}

// HiddenIDs lists every Space, folder, List and task id the user can't see;
// search uses it to drop results from private Spaces.
func (s *Service) HiddenIDs(ctx context.Context, ws, user string) (map[string]bool, error) {
	hidden, err := s.HiddenProjects(ctx, ws, user)
	if err != nil || len(hidden) == 0 {
		return hidden, err
	}
	a, _ := s.access(ctx, ws)
	out := map[string]bool{}
	for id := range hidden {
		out[id] = true
	}
	for list, proj := range a.listToProj {
		if hidden[proj] {
			out[list] = true
		}
	}
	folders, err := s.repo.ListFolders(ctx, ws)
	if err != nil {
		return nil, err
	}
	for _, f := range folders {
		if hidden[f.ProjectID] {
			out[f.ID] = true
		}
	}
	tasks, err := s.repo.ListTasks(ctx, ws)
	if err != nil {
		return nil, err
	}
	for _, t := range tasks {
		if hidden[a.listToProj[t.ListID]] {
			out[t.ID] = true
		}
	}
	return out, nil
}

// requireVisible fails as "not found" when actor can't see the Space, so
// private Spaces don't reveal that they exist. Automations act as the bot.
func (s *Service) requireVisible(ctx context.Context, ws, actor, projectID string, notFound error) error {
	if actor == "" || actor == domain.BotID {
		return nil
	}
	a, err := s.access(ctx, ws)
	if err != nil {
		return err
	}
	p, ok := a.projects[projectID]
	if !ok {
		forgetAccess(ws) // a Space created a moment ago
		if a, err = s.access(ctx, ws); err != nil {
			return err
		}
		if p, ok = a.projects[projectID]; !ok {
			return notFound
		}
	}
	if !viewerFor(actor, a.roles[actor]).sees(p) {
		return notFound
	}
	return nil
}

// CanAccess checks a request for /tasks/:id, /lists/:id, /folders/:id or /projects/:id.
func (s *Service) CanAccess(ctx context.Context, ws, user, kind, id string) error {
	switch kind {
	case "task":
		t, err := s.repo.GetTask(ctx, ws, id)
		if err != nil {
			return err
		}
		l, err := s.repo.GetList(ctx, ws, t.ListID)
		if err != nil {
			return err
		}
		return s.requireVisible(ctx, ws, user, l.ProjectID, domain.ErrTaskNotFound)
	case "list":
		l, err := s.repo.GetList(ctx, ws, id)
		if err != nil {
			return err
		}
		return s.requireVisible(ctx, ws, user, l.ProjectID, domain.ErrListNotFound)
	case "folder":
		f, err := s.repo.GetFolder(ctx, ws, id)
		if err != nil {
			return err
		}
		return s.requireVisible(ctx, ws, user, f.ProjectID, domain.ErrFolderNotFound)
	case "project":
		return s.requireVisible(ctx, ws, user, id, domain.ErrProjectNotFound)
	}
	return nil
}

// projectOf finds the Space a published item belongs to.
func (s *Service) projectOf(ctx context.Context, ws string, a *accessSnapshot, v any) string {
	taskProject := func(taskID string) string {
		t, err := s.repo.GetTask(ctx, ws, taskID)
		if err != nil {
			return ""
		}
		return a.listToProj[t.ListID]
	}
	switch x := v.(type) {
	case *domain.Project:
		return x.ID
	case *domain.Folder:
		return x.ProjectID
	case *domain.List:
		return x.ProjectID
	case *domain.Task:
		return a.listToProj[x.ListID]
	case domain.Task:
		return a.listToProj[x.ListID]
	case *domain.Comment:
		return taskProject(x.TaskID)
	case *domain.Activity:
		return taskProject(x.TaskID)
	case *domain.TimeEntry:
		return taskProject(x.TaskID)
	case *domain.CustomField:
		return a.listToProj[x.ListID]
	case *domain.Sprint:
		return x.ProjectID
	case *domain.Automation:
		return x.ProjectID
	case *domain.Form:
		return a.listToProj[x.ListID]
	}
	return ""
}

// audience is who may receive a change: nil means everyone in the workspace.
func (s *Service) audience(ctx context.Context, ws string, v any) []string {
	a, err := s.access(ctx, ws)
	if err != nil || !a.restricted {
		return nil
	}
	if l, ok := v.(*domain.List); ok {
		a.listToProj[l.ID] = l.ProjectID // a List created a moment ago
	}
	p := a.projects[s.projectOf(ctx, ws, a, v)]
	if p == nil {
		return nil
	}
	out := []string{}
	for user, role := range a.roles {
		if viewerFor(user, role).sees(p) {
			out = append(out, user)
		}
	}
	return out
}

// SetProjectAccess makes a Space private or open and sets who's in it.
// Owners, admins and the Space's own members may change it.
func (s *Service) SetProjectAccess(ctx context.Context, ws, actor, id string, private bool, members []string) (*domain.Project, error) {
	p, err := s.repo.GetProject(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	roles, err := s.members.Roles(ctx, ws)
	if err != nil {
		return nil, err
	}
	me := viewerFor(actor, roles[actor])
	if !me.all && !slices.Contains(p.Members, actor) {
		if p.Private || me.guest {
			return nil, domain.ErrProjectNotFound
		}
		if private {
			return nil, apperror.Forbidden("not_space_member", "only owners, admins and the Space’s members can make it private")
		}
	}
	members = uniq(members)
	for _, m := range members {
		if _, ok := roles[m]; !ok {
			return nil, domain.ErrNotMember
		}
	}
	// Whoever makes a Space private keeps seeing it.
	if private && !me.all && !slices.Contains(members, actor) {
		members = append(members, actor)
	}
	before := map[string]bool{}
	for user, role := range roles {
		before[user] = viewerFor(user, role).sees(p)
	}
	if err := s.repo.SetProjectAccess(ctx, ws, id, private, members); err != nil {
		return nil, err
	}
	forgetAccess(ws)
	p.Private, p.Members = private, members
	var lost, gained []string
	for user, role := range roles {
		now := viewerFor(user, role).sees(p)
		if before[user] && !now {
			lost = append(lost, user)
		} else if !before[user] && now {
			gained = append(gained, user)
		}
	}
	s.emit(ctx, ws, "projects", "upsert", p)
	if len(lost) > 0 {
		// Their clients drop the Space and everything in it.
		s.pub.Publish(ctx, ws, "projects", "delete", map[string]string{"id": id}, lost)
	}
	if len(gained) > 0 {
		// Their clients reload to pick up the Space's Lists and tasks.
		s.pub.Publish(ctx, ws, "access", "changed", map[string]string{"projectId": id}, gained)
	}
	return p, nil
}
