package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"html"
	"net/mail"
	"regexp"
	"strings"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

// InboundEmail is one message from the email provider's webhook.
type InboundEmail struct {
	From    string
	To      []string
	Subject string
	Text    string
}

// UserLookup finds a user id by email address.
type UserLookup func(ctx context.Context, email string) string

var replyPrefix = regexp.MustCompile(`(?i)^\s*((re|fw|fwd|aw|wg)\s*:\s*)+`)

func inboxToken() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	// Email local parts are case-insensitive in practice: stick to lowercase letters and digits.
	return strings.ToLower(strings.NewReplacer("-", "", "_", "").Replace(base64.RawURLEncoding.EncodeToString(b))), nil
}

// ListInbox returns the List's email token, creating one when asked.
func (s *Service) ListInbox(ctx context.Context, ws, actor, listID string, create, rotate bool) (string, error) {
	if err := s.CanAccess(ctx, ws, actor, "list", listID); err != nil {
		return "", err
	}
	if !rotate {
		if tok, err := s.repo.InboxToken(ctx, ws, listID); err == nil || !create {
			return tok, err
		}
	}
	tok, err := inboxToken()
	if err != nil {
		return "", err
	}
	return tok, s.repo.SaveInbox(ctx, ws, listID, actor, tok)
}

func (s *Service) DisableInbox(ctx context.Context, ws, actor, listID string) error {
	if err := s.CanAccess(ctx, ws, actor, "list", listID); err != nil {
		return err
	}
	return s.repo.DeleteInbox(ctx, ws, listID)
}

// ReceiveEmail turns an inbound message into a task in the List its address
// belongs to. Only members who can see that List may create tasks this way;
// anything else is dropped (and logged), so strangers can't spam a List.
func (s *Service) ReceiveEmail(ctx context.Context, domainName string, m InboundEmail, lookup UserLookup) (*domain.Task, error) {
	from, err := mail.ParseAddress(m.From)
	if err != nil {
		return nil, nil
	}
	for _, rcpt := range m.To {
		addrs, err := mail.ParseAddressList(rcpt)
		if err != nil {
			continue
		}
		for _, a := range addrs {
			local, host, ok := strings.Cut(strings.ToLower(a.Address), "@")
			if !ok || (domainName != "" && host != strings.ToLower(domainName)) {
				continue
			}
			local, _, _ = strings.Cut(local, "+") // allow plus-addressing
			ws, listID, err := s.repo.InboxByToken(ctx, local)
			if err != nil {
				continue
			}
			sender := lookup(ctx, from.Address)
			if sender == "" {
				s.log.Info("email-to-task: sender isn't a Meetspace user", zap.String("list", listID))
				return nil, nil
			}
			if ok, _ := s.members.IsMember(ctx, ws, sender); !ok {
				s.log.Info("email-to-task: sender isn't in the workspace", zap.String("list", listID))
				return nil, nil
			}
			if err := s.CanAccess(ctx, ws, sender, "list", listID); err != nil {
				return nil, nil
			}
			title := strings.TrimSpace(replyPrefix.ReplaceAllString(m.Subject, ""))
			if title == "" {
				title = "Email from " + from.Address
			}
			if len([]rune(title)) > 300 {
				title = string([]rune(title)[:300])
			}
			return s.CreateTask(ctx, ws, sender, TaskInput{ListID: listID, Title: title, Description: textToHTML(m.Text), Tags: []string{"email"}})
		}
	}
	return nil, nil
}

// textToHTML keeps an email's paragraphs, escaped, and trims quoted replies.
func textToHTML(t string) string {
	var keep []string
	for _, line := range strings.Split(strings.ReplaceAll(t, "\r\n", "\n"), "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), ">") {
			continue
		}
		if strings.HasPrefix(line, "On ") && strings.HasSuffix(strings.TrimSpace(line), "wrote:") {
			break
		}
		keep = append(keep, line)
	}
	body := strings.TrimSpace(strings.Join(keep, "\n"))
	if len(body) > 20000 {
		body = body[:20000]
	}
	if body == "" {
		return ""
	}
	var out strings.Builder
	for _, p := range strings.Split(body, "\n\n") {
		out.WriteString("<p>" + strings.ReplaceAll(html.EscapeString(strings.TrimSpace(p)), "\n", "<br>") + "</p>")
	}
	return out.String()
}
