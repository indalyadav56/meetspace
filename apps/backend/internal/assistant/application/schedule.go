package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/assistant/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// NextRun is the first scheduled time strictly after `after`, or nil when the
// agent isn't scheduled. hhmm and day are in tz (day: 0=Sunday, for weekly).
func NextRun(schedule, hhmm string, day int, tz string, after time.Time) *time.Time {
	if schedule == "" || schedule == "none" {
		return nil
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	var h, m int
	if _, err := fmt.Sscanf(hhmm, "%d:%d", &h, &m); err != nil {
		h, m = 9, 0
	}
	local := after.In(loc)
	for i := 0; i <= 8; i++ {
		d := time.Date(local.Year(), local.Month(), local.Day()+i, h, m, 0, 0, loc)
		if !d.After(after) {
			continue
		}
		wd := d.Weekday()
		switch schedule {
		case "weekdays":
			if wd == time.Saturday || wd == time.Sunday {
				continue
			}
		case "weekly":
			if int(wd) != day {
				continue
			}
		}
		return &d
	}
	return nil
}

// cleanSchedule validates the schedule fields. An empty Schedule means "leave
// the schedule as it is", so older clients that don't send it can't clear it.
func (in *AgentInput) cleanSchedule() error {
	switch in.Schedule {
	case "":
		return nil
	case "none", "daily", "weekdays", "weekly":
	default:
		return apperror.Invalid("invalid_schedule", "schedule must be none, daily, weekdays or weekly")
	}
	if in.ScheduleTime == "" {
		in.ScheduleTime = "09:00"
	}
	if t, err := time.Parse("15:04", in.ScheduleTime); err != nil {
		return apperror.Invalid("invalid_time", "time must look like 09:00")
	} else {
		in.ScheduleTime = t.Format("15:04")
	}
	if in.ScheduleDay < 0 || in.ScheduleDay > 6 {
		return apperror.Invalid("invalid_day", "day must be 0 (Sunday) to 6 (Saturday)")
	}
	if in.Timezone == "" {
		in.Timezone = "UTC"
	}
	if _, err := time.LoadLocation(in.Timezone); err != nil {
		return apperror.Invalid("invalid_timezone", "unknown timezone")
	}
	in.SchedulePrompt = strings.TrimSpace(in.SchedulePrompt)
	if len([]rune(in.SchedulePrompt)) > 2000 {
		return apperror.Invalid("invalid_prompt", "keep the scheduled request under 2000 characters")
	}
	if in.Schedule != "none" && in.SchedulePrompt == "" {
		in.SchedulePrompt = "Do your scheduled check-in and report what matters."
	}
	if in.ChannelID != nil && *in.ChannelID == "" {
		in.ChannelID = nil
	}
	return nil
}

func applySchedule(a *domain.Agent, in AgentInput, now time.Time) {
	a.Schedule, a.ScheduleTime, a.ScheduleDay, a.Timezone, a.SchedulePrompt, a.ChannelID = in.Schedule, in.ScheduleTime, in.ScheduleDay, in.Timezone, in.SchedulePrompt, in.ChannelID
	a.NextRunAt = NextRun(a.Schedule, a.ScheduleTime, a.ScheduleDay, a.Timezone, now)
}

// Poster delivers a scheduled agent's report to a chat channel.
type Poster func(ctx context.Context, ws, userID, channelID, text string) error

// RunDue runs every scheduled agent whose time has come. Each run is claimed
// first, so several server processes never run the same one twice.
func (s *Service) RunDue(ctx context.Context, post Poster) (int, error) {
	if s.agent == nil {
		return 0, nil
	}
	now := time.Now()
	due, err := s.agents.Due(ctx, now, 20)
	if err != nil {
		return 0, err
	}
	ran := 0
	for _, a := range due {
		next := NextRun(a.Schedule, a.ScheduleTime, a.ScheduleDay, a.Timezone, now)
		if ok, err := s.agents.Claim(ctx, a.ID, *a.NextRunAt, next); err != nil || !ok {
			continue
		}
		if a.CreatedBy == nil || a.Kind == domain.KindSkill {
			continue
		}
		var out strings.Builder
		runCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
		err := s.Chat(runCtx, RunRequest{
			WorkspaceID: a.WorkspaceID, UserID: *a.CreatedBy, SessionID: uuid.NewString(), AgentID: a.ID, Message: a.SchedulePrompt,
			Context: "This is an automatic scheduled run (" + a.Schedule + " at " + a.ScheduleTime + " " + a.Timezone + "); nobody is waiting to reply, so finish with a complete report.",
		}, func(e Event) {
			if e.Type == "text" {
				out.WriteString(e.Text)
			}
		})
		cancel()
		result := strings.TrimSpace(out.String())
		if err != nil {
			result = "The scheduled run failed: " + err.Error()
		}
		if result == "" {
			result = "Nothing to report."
		}
		_ = s.agents.SaveRun(ctx, a.ID, result, now)
		if a.ChannelID != nil && post != nil {
			_ = post(ctx, a.WorkspaceID, *a.CreatedBy, *a.ChannelID, a.Icon+" **"+a.Name+"** · scheduled report\n\n"+result)
		}
		ran++
	}
	return ran, nil
}
