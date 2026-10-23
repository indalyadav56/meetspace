// Command seed fills a fresh database with a demo workspace so the app has
// something to show. It drives the application services directly, so every
// business rule (bootstrap content, activity, notifications) applies.
//
// Demo sign-in: demo@meetspace.dev / meetspace-demo (all demo users share the password).
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	chatapp "github.com/indalyadav56/meetspace/backend/internal/chat/application"
	chatdomain "github.com/indalyadav56/meetspace/backend/internal/chat/domain"
	"github.com/indalyadav56/meetspace/backend/internal/config"
	"github.com/indalyadav56/meetspace/backend/internal/di"
	goalsapp "github.com/indalyadav56/meetspace/backend/internal/goals/application"
	goalsdomain "github.com/indalyadav56/meetspace/backend/internal/goals/domain"
	identitydomain "github.com/indalyadav56/meetspace/backend/internal/identity/domain"
	workapp "github.com/indalyadav56/meetspace/backend/internal/work/application"
	workdomain "github.com/indalyadav56/meetspace/backend/internal/work/domain"
	workspacedomain "github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

const demoPassword = "meetspace-demo"

var people = []struct{ email, name string }{
	{"demo@meetspace.dev", "Alex Rivera"},
	{"priya@meetspace.dev", "Priya Shah"},
	{"marcus@meetspace.dev", "Marcus Chen"},
	{"sofia@meetspace.dev", "Sofia Garcia"},
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "seed:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	shared, err := di.NewShared(ctx, cfg, "meetspace-seed")
	if err != nil {
		return err
	}
	defer shared.Close()
	cfg.AI.GeminiAPIKey = "" // the seeder never talks to the model
	c, err := di.NewServerContainer(ctx, shared)
	if err != nil {
		return err
	}
	s := c.Services

	ids := map[string]string{}
	for _, p := range people {
		u, _, err := s.Auth.Register(ctx, p.email, p.name, demoPassword)
		if errors.Is(err, identitydomain.ErrEmailExists) {
			fmt.Println("already seeded; demo login:", people[0].email, "/", demoPassword)
			return nil
		}
		if err != nil {
			return fmt.Errorf("register %s: %w", p.email, err)
		}
		ids[p.name] = u.ID
	}
	alex, priya, marcus, sofia := ids["Alex Rivera"], ids["Priya Shah"], ids["Marcus Chen"], ids["Sofia Garcia"]

	ws, err := s.Workspaces.Create(ctx, alex, "", "Acme Inc", "#7b68ee")
	if err != nil {
		return err
	}
	for _, p := range people[1:] {
		if _, err := s.Workspaces.Invite(ctx, ws.ID, alex, p.email, p.name, workspacedomain.RoleMember); err != nil {
			return err
		}
	}
	if _, err := s.Workspaces.Create(ctx, alex, "", "Side projects", "#22c55e"); err != nil {
		return err
	}

	// Projects, folders and lists.
	eng, err := s.Work.CreateProject(ctx, ws.ID, "", "Engineering", "#3b82f6")
	if err != nil {
		return err
	}
	platform, err := s.Work.CreateFolder(ctx, ws.ID, "", eng.ID, "Platform")
	if err != nil {
		return err
	}
	backlog, err := s.Work.CreateList(ctx, ws.ID, "", eng.ID, &platform.ID, "Sprint backlog")
	if err != nil {
		return err
	}
	bugs, err := s.Work.CreateList(ctx, ws.ID, "", eng.ID, nil, "Bugs")
	if err != nil {
		return err
	}
	mkt, err := s.Work.CreateProject(ctx, ws.ID, "", "Marketing", "#ec4899")
	if err != nil {
		return err
	}
	launch, err := s.Work.ApplyTemplate(ctx, ws.ID, sofia, "", mkt.ID, "launch", "Q4 launch")
	if err != nil {
		return err
	}
	if _, err := s.Work.ApplyTemplate(ctx, ws.ID, sofia, "", mkt.ID, "content", "Content calendar"); err != nil {
		return err
	}

	day := func(offset int) *string {
		d := time.Now().UTC().AddDate(0, 0, offset).Format("2006-01-02")
		return &d
	}
	prio := func(p string) *string { return &p }
	status := func(p *workdomain.Project, t workdomain.StatusType) string { return p.FirstOfType(t).ID }

	type seedTask struct {
		list      string
		title     string
		desc      string
		status    workdomain.StatusType
		priority  string
		due       int
		assignees []string
		tags      []string
	}
	tasks := []seedTask{
		{backlog.ID, "Design realtime sync protocol", "<p>Events fan out through Redis to every API instance.</p>", workdomain.StatusDone, "high", -6, []string{marcus}, []string{"backend"}},
		{backlog.ID, "Self-host LiveKit for calls", "<p>Run livekit-server next to the API and issue room tokens from the backend.</p>", workdomain.StatusActive, "urgent", 2, []string{marcus, alex}, []string{"meetings"}},
		{backlog.ID, "AI assistant on Google ADK", "<p>Gemini agent with workspace tools: search, create and update tasks, read docs.</p>", workdomain.StatusActive, "high", 4, []string{priya}, []string{"ai"}},
		{backlog.ID, "Keyboard shortcuts cheat sheet", "", workdomain.StatusOpen, "low", 12, []string{sofia}, nil},
		{backlog.ID, "Offline mode for docs", "", workdomain.StatusOpen, "normal", 0, nil, []string{"docs"}},
		{bugs.ID, "Board view flickers when dragging between columns", "<p>Repro: drag a card quickly across three columns.</p>", workdomain.StatusOpen, "high", -1, []string{priya}, []string{"bug", "frontend"}},
		{bugs.ID, "Timezone off by one on due dates", "", workdomain.StatusActive, "normal", 1, []string{marcus}, []string{"bug"}},
	}
	created := make([]*workdomain.Task, 0, len(tasks))
	for _, t := range tasks {
		proj := eng
		in := workapp.TaskInput{ListID: t.list, Title: t.title, Description: t.desc, StatusID: status(proj, t.status),
			Priority: prio(t.priority), Assignees: t.assignees, Tags: t.tags}
		if t.due != 0 {
			in.DueDate = day(t.due)
		}
		task, err := s.Work.CreateTask(ctx, ws.ID, alex, in)
		if err != nil {
			return fmt.Errorf("task %q: %w", t.title, err)
		}
		created = append(created, task)
	}
	if _, err := s.Work.AddComment(ctx, ws.ID, priya, created[1].ID, "Ports 7880-7882 are open on staging. UDP range next.", nil, nil); err != nil {
		return err
	}
	if _, err := s.Work.CreateTask(ctx, ws.ID, sofia, workapp.TaskInput{ListID: launch.ID, Title: "Record product walkthrough clip", Priority: prio("normal"), Assignees: []string{sofia}, DueDate: day(6)}); err != nil {
		return err
	}

	// Docs.
	if _, err := s.Docs.CreateDoc(ctx, ws.ID, alex, "", &eng.ID, "Engineering handbook",
		"<h1>Engineering handbook</h1><p>How we plan, build and ship Meetspace.</p><h2>Rituals</h2><ul><li><p>Monday planning</p></li><li><p>Friday demo</p></li></ul>", "📘"); err != nil {
		return err
	}
	if _, err := s.Docs.CreateDoc(ctx, ws.ID, sofia, "", &mkt.ID, "Launch messaging",
		"<h1>Launch messaging</h1><p><strong>One app for tasks, docs, chat and calls.</strong></p>", "🚀"); err != nil {
		return err
	}

	// Goal.
	g, err := s.Goals.Create(ctx, ws.ID, "", alex)
	if err != nil {
		return err
	}
	name, desc, due := "Ship Meetspace 1.0", "Everything a team needs in one workspace.", day(45)
	targets := []goalsdomain.Target{
		{ID: "t1", Name: "Close launch tasks", Kind: "tasks", ListID: &launch.ID},
		{ID: "t2", Name: "Beta teams onboarded", Kind: "number", Start: 0, Current: 12, Target: 50},
	}
	if _, err := s.Goals.Update(ctx, ws.ID, g.ID, goalsapp.Patch{Name: &name, Description: &desc, DueDate: due, Targets: &targets}); err != nil {
		return err
	}

	// Chat.
	snap, err := s.Chat.Snapshot(ctx, ws.ID, alex)
	if err != nil {
		return err
	}
	if chans, ok := snap["channels"].([]chatdomain.Channel); ok && len(chans) > 0 {
		general := chans[0].ID
		for _, m := range []struct{ by, text string }{
			{alex, "Welcome to Meetspace 👋 Tasks, docs, chat and calls all live here now."},
			{marcus, "LiveKit is running locally. Hit the call button in any channel to try it."},
			{priya, "@Alex Rivera the assistant can now create tasks for you, just ask it."},
		} {
			if _, err := s.Chat.Send(ctx, ws.ID, m.by, chatapp.SendInput{ChannelID: general, Text: m.text}); err != nil {
				return err
			}
		}
	}

	fmt.Println("seeded workspace", ws.Name, "- demo login:", people[0].email, "/", demoPassword)
	return nil
}
