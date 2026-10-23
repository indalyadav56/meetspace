package email

import (
	"bytes"
	"context"
	"html/template"
	"net/url"
	"strings"

	"github.com/indalyadav56/meetspace/backend/pkg/mailer"
)

// Mailer sends one rendered message.
type Mailer interface {
	Send(ctx context.Context, m mailer.Message) error
}

// Sender renders transactional emails and hands them to a Mailer (the
// Resend API or an SMTP server).
type Sender struct {
	mail Mailer
	urls links
}

func NewSender(m Mailer, webURL string) *Sender {
	return &Sender{mail: m, urls: links{webURL}}
}

func (s *Sender) SendPasswordReset(ctx context.Context, to, rawToken string) error {
	link := s.urls.reset(rawToken)
	return s.send(ctx, to, "Reset your Meetspace password", emailData{
		Heading: "Reset your password",
		Body:    "Someone asked to reset the password for your Meetspace account. If it was you, choose a new password below. The link works for one hour.",
		Button:  "Choose a new password",
		Link:    link,
		Footer:  "If you didn’t ask for this, you can ignore this email — your password won’t change.",
	})
}

func (s *Sender) SendWorkspaceInvite(ctx context.Context, to, inviter, workspace, rawToken string) error {
	d := emailData{
		Heading: inviter + " invited you to " + workspace,
		Body:    "You’ve been added to the " + workspace + " workspace on Meetspace, where your team keeps its tasks, docs, chat and calls.",
		Button:  "Open " + workspace,
		Link:    s.urls.login(),
		Footer:  "You’re receiving this because " + inviter + " added " + to + " to their workspace.",
	}
	if rawToken != "" {
		d.Body += " Choose a password to get started — the link works for 7 days."
		d.Button = "Set your password"
		d.Link = s.urls.setPassword(rawToken)
	}
	return s.send(ctx, to, inviter+" invited you to "+workspace+" on Meetspace", d)
}

func (s *Sender) send(ctx context.Context, to, subject string, d emailData) error {
	var html bytes.Buffer
	if err := layout.Execute(&html, d); err != nil {
		return err
	}
	text := strings.Join([]string{d.Heading, "", d.Body, "", d.Button + ": " + d.Link, "", d.Footer}, "\n")
	return s.mail.Send(ctx, mailer.Message{To: to, Subject: subject, Text: text, HTML: html.String()})
}

type emailData struct {
	Heading, Body, Button, Link, Footer string
}

// links builds URLs into the web app.
type links struct{ base string }

func (l links) reset(token string) string {
	return strings.TrimRight(l.base, "/") + "/reset-password?token=" + url.QueryEscape(token)
}
func (l links) setPassword(token string) string { return l.reset(token) + "&invite=1" }
func (l links) login() string                   { return strings.TrimRight(l.base, "/") + "/login" }

var layout = template.Must(template.New("email").Parse(`<!doctype html>
<html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;padding:32px">
<tr><td style="font-size:18px;font-weight:700;color:#4f46e5;padding-bottom:20px">Meetspace</td></tr>
<tr><td style="font-size:22px;font-weight:700;line-height:1.3;padding-bottom:12px">{{.Heading}}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#334155;padding-bottom:24px">{{.Body}}</td></tr>
<tr><td style="padding-bottom:24px"><a href="{{.Link}}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">{{.Button}}</a></td></tr>
<tr><td style="font-size:12px;line-height:1.5;color:#64748b;word-break:break-all">Or paste this link into your browser:<br>{{.Link}}</td></tr>
<tr><td style="font-size:12px;line-height:1.5;color:#94a3b8;padding-top:20px;border-top:1px solid #e2e8f0">{{.Footer}}</td></tr>
</table></td></tr></table></body></html>`))
