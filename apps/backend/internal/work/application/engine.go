package application

import (
	"context"
	"strconv"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

// maxAutomationDepth stops automations from triggering each other forever.
const maxAutomationDepth = 2

// runAutomations executes every enabled automation in the task's project whose
// trigger matches. Actions run as the bot; their own changes may trigger
// further automations up to maxAutomationDepth.
func (s *Service) runAutomations(ctx context.Context, t *domain.Task, proj *domain.Project, actorID, trigger, value string, depth int) {
	if depth > maxAutomationDepth {
		return
	}
	ws := t.WorkspaceID
	all, err := s.repo.ListAutomations(ctx, ws)
	if err != nil {
		s.log.Warn("load automations failed", zap.Error(err))
		return
	}
	for _, a := range all {
		if !a.Enabled || a.ProjectID != proj.ID || a.Trigger.Type != trigger || (a.Trigger.Value != "" && a.Trigger.Value != value) {
			continue
		}
		for _, act := range a.Actions {
			cur, err := s.repo.GetTask(ctx, ws, t.ID)
			if err != nil {
				return // task deleted by an earlier action
			}
			prev := *cur
			prev.Assignees = append([]string(nil), cur.Assignees...)
			changed := false
			switch act.Type {
			case "set_status":
				if _, ok := proj.Status(act.Value); ok && cur.StatusID != act.Value {
					cur.StatusID, changed = act.Value, true
				}
			case "set_priority":
				if validPriorities[act.Value] && deref(cur.Priority) != act.Value {
					v := act.Value
					cur.Priority, changed = &v, true
				}
			case "add_assignee":
				if ok, _ := s.members.IsMember(ctx, ws, act.Value); ok && !contains(cur.Assignees, act.Value) {
					cur.Assignees, changed = append(cur.Assignees, act.Value), true
				}
			case "add_tag":
				tags := cleanTags(append(append([]string{}, cur.Tags...), act.Value))
				if len(tags) != len(cur.Tags) {
					cur.Tags, changed = tags, true
				}
			case "set_due_in":
				days, err := strconv.Atoi(act.Value)
				if err == nil {
					d := s.now().AddDate(0, 0, days).Format(dateLayout)
					cur.DueDate, changed = &d, true
				}
			case "add_comment":
				if act.Value != "" {
					c := &domain.Comment{TaskID: cur.ID, UserID: domain.BotID, Text: act.Value}
					if err := s.repo.CreateComment(ctx, ws, c); err == nil {
						s.emit(ctx, ws, "comments", "upsert", c)
					}
				}
			case "ai_triage":
				go s.aiTriage(ws, cur.ID, proj, act.Value)
			case "notify":
				text := act.Value
				if text == "" {
					text = "Automation “" + a.Name + "” ran"
				}
				// The actor is included on purpose: "notify me" recipes target them.
				recipients := append(append([]string{actorID}, cur.Assignees...), cur.Watchers...)
				for _, r := range uniq(recipients) {
					if r == domain.BotID {
						continue
					}
					if err := s.notify.Notify(ctx, ws, r, "status", cur.ID, "", text, true); err != nil {
						s.log.Warn("automation notify failed", zap.Error(err))
					}
				}
			}
			if changed {
				if err := s.repo.UpdateTask(ctx, cur); err != nil {
					s.log.Warn("automation update failed", zap.Error(err))
					continue
				}
				s.emit(ctx, ws, "tasks", "upsert", cur)
				s.afterUpdate(ctx, &prev, cur, proj, domain.BotID, depth+1)
			}
		}
		s.logActivity(ctx, ws, t.ID, domain.BotID, "ran automation “"+a.Name+"”")
		if updated, err := s.repo.RecordAutomationRun(ctx, ws, a.ID, s.now()); err == nil {
			s.emit(ctx, ws, "automations", "upsert", updated)
		}
	}
}

// spawnRecurrence creates the next occurrence of a finished repeating task and
// stops the finished one from repeating again.
func (s *Service) spawnRecurrence(ctx context.Context, t *domain.Task, proj *domain.Project, actorID string) {
	shift := func(v *string) *string {
		if v == nil {
			return nil
		}
		d, err := time.Parse(dateLayout, *v)
		if err != nil {
			return nil
		}
		switch *t.Recurrence {
		case "daily":
			d = d.AddDate(0, 0, 1)
		case "weekly":
			d = d.AddDate(0, 0, 7)
		default:
			d = d.AddDate(0, 1, 0)
		}
		out := d.Format(dateLayout)
		return &out
	}
	due := shift(t.DueDate)
	if due == nil {
		next := s.now().AddDate(0, 0, 1).Format(dateLayout)
		due = &next
	}
	checklist := make([]domain.ChecklistItem, len(t.Checklist))
	for i, c := range t.Checklist {
		checklist[i] = domain.ChecklistItem{Text: c.Text}
	}
	next, err := s.CreateTask(ctx, t.WorkspaceID, actorID, TaskInput{
		ListID: t.ListID, Title: t.Title, Description: t.Description, StatusID: proj.FirstOfType(domain.StatusOpen).ID,
		Priority: t.Priority, Assignees: t.Assignees, Tags: t.Tags, StartDate: shift(t.StartDate), DueDate: due,
		Estimate: t.Estimate, Checklist: checklist, Recurrence: t.Recurrence, Custom: t.Custom, Points: t.Points,
	})
	if err != nil {
		s.log.Warn("recurrence spawn failed", zap.Error(err))
		return
	}
	t.Recurrence = nil
	if err := s.repo.UpdateTask(ctx, t); err == nil {
		s.emit(ctx, t.WorkspaceID, "tasks", "upsert", t)
	}
	s.logActivity(ctx, t.WorkspaceID, t.ID, actorID, "completed a recurring task — next one is MS-"+strconv.FormatInt(next.Key, 10))
}
