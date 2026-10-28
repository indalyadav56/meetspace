package application

import (
	"context"
	"fmt"
	"html"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

// Triage is what an AI suggests for a new task.
type Triage struct {
	Priority string   `json:"priority"` // urgent, high, normal, low or ""
	Tags     []string `json:"tags"`
	Assignee string   `json:"assignee"` // a member id or ""
	Reason   string   `json:"reason"`
}

// TriageInput is what the AI sees: the task, the people and the tags in use.
type TriageInput struct {
	Title, Description, Instructions string
	People                           map[string]string // id → name
	Tags                             []string
}

// Triager suggests priority, tags and an owner.
type Triager interface {
	Triage(ctx context.Context, in TriageInput) (*Triage, error)
}

// UseTriager turns on the "AI triage" automation action.
func (s *Service) UseTriager(t Triager) { s.triager = t }

var htmlTag = regexp.MustCompile(`<[^>]+>`)

// aiTriage runs after the request that triggered it, so creating a task never
// waits on the model. Only empty fields are filled in: it never overrides people.
func (s *Service) aiTriage(ws, taskID string, proj *domain.Project, instructions string) {
	if s.triager == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	t, err := s.repo.GetTask(ctx, ws, taskID)
	if err != nil {
		return
	}
	roles, err := s.members.Roles(ctx, ws)
	if err != nil {
		return
	}
	people := map[string]string{}
	for id, role := range roles {
		if role != "guest" {
			people[id] = s.names.DisplayName(ctx, id)
		}
	}
	all, _ := s.repo.ListTasks(ctx, ws)
	seen := map[string]bool{}
	var tags []string
	for _, x := range all {
		for _, g := range x.Tags {
			if !seen[g] && len(tags) < 60 {
				seen[g] = true
				tags = append(tags, g)
			}
		}
	}
	desc := html.UnescapeString(htmlTag.ReplaceAllString(t.Description, " "))
	sug, err := s.triager.Triage(ctx, TriageInput{Title: t.Title, Description: desc, Instructions: instructions, People: people, Tags: tags})
	if err != nil {
		s.log.Warn("ai triage failed", zap.Error(err))
		return
	}
	prev := *t
	var notes []string
	if t.Priority == nil && validPriorities[sug.Priority] {
		p := sug.Priority
		t.Priority = &p
		notes = append(notes, "priority "+p)
	}
	if len(sug.Tags) > 0 {
		next := cleanTags(append(append([]string{}, t.Tags...), sug.Tags[:min(3, len(sug.Tags))]...))
		if len(next) > len(t.Tags) {
			notes = append(notes, "tags "+strings.Join(next[len(t.Tags):], ", "))
			t.Tags = next
		}
	}
	if len(t.Assignees) == 0 && people[sug.Assignee] != "" {
		t.Assignees = []string{sug.Assignee}
		notes = append(notes, "assigned to "+people[sug.Assignee])
	}
	if len(notes) == 0 {
		return
	}
	if err := s.repo.UpdateTask(ctx, t); err != nil {
		s.log.Warn("ai triage update failed", zap.Error(err))
		return
	}
	s.emit(ctx, ws, "tasks", "upsert", t)
	text := fmt.Sprintf("🤖 AI triage set %s.", strings.Join(notes, "; "))
	if r := strings.TrimSpace(sug.Reason); r != "" {
		text += " " + r
	}
	c := &domain.Comment{TaskID: t.ID, UserID: domain.BotID, Text: text}
	if err := s.repo.CreateComment(ctx, ws, c); err == nil {
		s.emit(ctx, ws, "comments", "upsert", c)
	}
	if len(t.Assignees) > len(prev.Assignees) {
		s.notifyAll(ctx, ws, t.Assignees, "assigned", t.ID, domain.BotID, "assigned you to this task (AI triage)", true)
	}
}
