// Package email renders notification emails: a short batch right after
// something happens, or a once-a-day digest.
package email

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/notify/application"
	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/mailer"
)

type Mailer interface {
	Send(ctx context.Context, m mailer.Message) error
}

type Sender struct {
	mail   Mailer
	webURL string
}

func NewSender(m Mailer, webURL string) *Sender {
	return &Sender{mail: m, webURL: strings.TrimRight(webURL, "/")}
}

type item struct {
	Line, Task, Key, Link, Workspace string
}

type due struct {
	Title, Key, When, List, Link string
	Overdue                      bool
}

type data struct {
	Heading, Intro, AppLink, SettingsLink string
	Items                                 []item
	Due                                   []due
}

func (s *Sender) SendNotifications(ctx context.Context, to, name string, items []domain.Outgoing, dueTasks []domain.DueTask, digest bool) error {
	if to == "" || len(items) == 0 {
		return nil
	}
	first := strings.Split(strings.TrimSpace(name), " ")[0]
	d := data{AppLink: s.webURL + "/app/inbox", SettingsLink: s.webURL + "/app/settings?tab=notifications"}
	for _, o := range items {
		it := item{Line: application.Line(o), Task: o.TaskTitle, Workspace: o.WorkspaceName, Link: s.webURL + "/app/notifications"}
		if o.TaskID != "" && o.TaskTitle != "" {
			it.Link = s.webURL + "/app/t/" + o.TaskID
			it.Key = fmt.Sprintf("MS-%d", o.TaskKey)
		}
		d.Items = append(d.Items, it)
	}
	for _, t := range dueTasks {
		when := "Due today"
		if t.Overdue {
			when = "Overdue · " + t.DueDate
		}
		d.Due = append(d.Due, due{Title: t.Title, Key: fmt.Sprintf("MS-%d", t.Key), When: when, List: t.ListName, Link: s.webURL + "/app/t/" + t.ID, Overdue: t.Overdue})
	}
	subject := ""
	if digest {
		d.Heading = "Your daily summary"
		d.Intro = fmt.Sprintf("Good morning %s — here’s what happened while you were away.", first)
		subject = fmt.Sprintf("Your Meetspace summary: %d update%s", len(items), plural(len(items)))
	} else if len(items) == 1 {
		d.Heading = items[0].TaskTitle
		if d.Heading == "" {
			d.Heading = "New in " + items[0].WorkspaceName
		}
		d.Intro = application.Line(items[0])
		subject = application.Line(items[0])
		if items[0].TaskTitle != "" {
			subject += ": " + items[0].TaskTitle
		}
	} else {
		d.Heading = fmt.Sprintf("%d new updates", len(items))
		d.Intro = fmt.Sprintf("Hi %s, here’s what’s new.", first)
		subject = fmt.Sprintf("%d new updates in Meetspace", len(items))
	}
	var html bytes.Buffer
	if err := tpl.Execute(&html, d); err != nil {
		return err
	}
	var text strings.Builder
	text.WriteString(d.Heading + "\n\n" + d.Intro + "\n\n")
	for _, it := range d.Items {
		text.WriteString("• " + it.Line)
		if it.Task != "" {
			text.WriteString(" — " + it.Task)
		}
		text.WriteString("\n  " + it.Link + "\n")
	}
	if len(d.Due) > 0 {
		text.WriteString("\nOn your plate today\n")
		for _, t := range d.Due {
			text.WriteString("• " + t.When + ": " + t.Title + "\n  " + t.Link + "\n")
		}
	}
	text.WriteString("\nChange what you get: " + d.SettingsLink + "\n")
	return s.mail.Send(ctx, mailer.Message{To: to, Subject: truncate(subject, 140), Text: text.String(), HTML: html.String()})
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func truncate(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n-1]) + "…"
	}
	return s
}

var tpl = template.Must(template.New("n").Parse(`<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1917">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;padding:28px">
<tr><td style="font-size:13px;font-weight:700;color:#0f766e;letter-spacing:.02em">MEETSPACE</td></tr>
<tr><td style="padding-top:14px;font-size:20px;font-weight:700">{{.Heading}}</td></tr>
<tr><td style="padding-top:6px;font-size:14px;color:#57534e">{{.Intro}}</td></tr>
{{range .Items}}<tr><td style="padding-top:14px"><a href="{{.Link}}" style="display:block;text-decoration:none;color:#1c1917;border:1px solid #e7e5e4;border-radius:10px;padding:12px 14px">
<div style="font-size:14px">{{.Line}}</div>{{if .Task}}<div style="font-size:12px;color:#78716c;padding-top:3px">{{if .Key}}{{.Key}} · {{end}}{{.Task}} · {{.Workspace}}</div>{{end}}</a></td></tr>{{end}}
{{if .Due}}<tr><td style="padding-top:22px;font-size:13px;font-weight:700;color:#57534e">ON YOUR PLATE TODAY</td></tr>
{{range .Due}}<tr><td style="padding-top:8px"><a href="{{.Link}}" style="text-decoration:none;color:#1c1917;font-size:14px">{{.Title}}</a>
<span style="font-size:12px;color:{{if .Overdue}}#dc2626{{else}}#b45309{{end}}"> · {{.When}}</span><span style="font-size:12px;color:#a8a29e"> · {{.Key}} · {{.List}}</span></td></tr>{{end}}{{end}}
<tr><td style="padding-top:24px"><a href="{{.AppLink}}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:9px">Open your Inbox</a></td></tr>
<tr><td style="padding-top:22px;font-size:12px;color:#a8a29e">You get these because of your notification settings. <a href="{{.SettingsLink}}" style="color:#78716c">Change them</a>.</td></tr>
</table></td></tr></table></body></html>`))
