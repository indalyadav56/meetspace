// Package application implements chat use cases.
package application

import (
	"context"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/chat/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

type Notifier interface {
	Notify(ctx context.Context, workspaceID, recipientID, kind, taskID, actorID, text string, important bool) error
}

type Members interface {
	MemberIDs(ctx context.Context, workspaceID string) ([]string, error)
}

type MentionResolver interface {
	Mentioned(ctx context.Context, workspaceID, text string) []string
}

// TaskCreator turns a message into a task in the work context.
type TaskCreator interface {
	CreateTaskFromText(ctx context.Context, workspaceID, actorID, taskID, listID, title, description string) (string, error)
}

type Service struct {
	repo     domain.Repository
	pub      Publisher
	notify   Notifier
	members  Members
	mentions MentionResolver
	tasks    TaskCreator
	log      *zap.Logger
}

func NewService(repo domain.Repository, pub Publisher, notify Notifier, members Members, mentions MentionResolver, tasks TaskCreator, log *zap.Logger) *Service {
	return &Service{repo: repo, pub: pub, notify: notify, members: members, mentions: mentions, tasks: tasks, log: log}
}

var slugRe = regexp.MustCompile(`[^a-z0-9_-]+`)

func slug(name string) string {
	s := slugRe.ReplaceAllString(strings.ReplaceAll(strings.ToLower(strings.TrimSpace(name)), " ", "-"), "")
	return strings.Trim(s, "-")
}

// Bootstrap creates #general in a new workspace.
func (s *Service) Bootstrap(ctx context.Context, ws, _ string) error {
	_, err := s.CreateChannel(ctx, ws, "", "general", "Company-wide announcements and chatter")
	return err
}

// audience returns who may see a channel's traffic: nil (everyone) for channels, the members for DMs.
func audience(c *domain.Channel) []string {
	if c.Kind == "dm" {
		return c.Members
	}
	return nil
}

func (s *Service) canSee(c *domain.Channel, userID string) bool {
	if c.Kind != "dm" {
		return true
	}
	for _, m := range c.Members {
		if m == userID {
			return true
		}
	}
	return false
}

func (s *Service) channelFor(ctx context.Context, ws, id, userID string) (*domain.Channel, error) {
	c, err := s.repo.GetChannel(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if !s.canSee(c, userID) {
		return nil, domain.ErrNotInDM
	}
	return c, nil
}

// withMembers fills a public channel's member list with the current workspace members.
func (s *Service) withMembers(ctx context.Context, ws string, c *domain.Channel) *domain.Channel {
	if c.Kind == "channel" {
		if ids, err := s.members.MemberIDs(ctx, ws); err == nil {
			c.Members = ids
		}
	}
	return c
}

func (s *Service) CreateChannel(ctx context.Context, ws, id, name, topic string) (*domain.Channel, error) {
	n := slug(name)
	if n == "" || len(n) > 80 {
		return nil, apperror.Invalid("invalid_name", "channel name must be 1-80 letters, digits or dashes")
	}
	c := &domain.Channel{ID: id, WorkspaceID: ws, Name: n, Kind: "channel", Members: []string{}, Topic: strings.TrimSpace(topic)}
	if err := s.repo.CreateChannel(ctx, c); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "channels", "upsert", s.withMembers(ctx, ws, c), nil)
	return c, nil
}

// OpenDM finds or creates the direct conversation between actor and other.
func (s *Service) OpenDM(ctx context.Context, ws, actorID, id, otherID string) (*domain.Channel, error) {
	ids, err := s.members.MemberIDs(ctx, ws)
	if err != nil {
		return nil, err
	}
	found := false
	for _, id := range ids {
		found = found || id == otherID
	}
	if !found || otherID == actorID {
		return nil, apperror.Invalid("invalid_member", "pick another member of this workspace")
	}
	if c, err := s.repo.FindDM(ctx, ws, actorID, otherID); err == nil {
		return c, nil
	} else if err != domain.ErrChannelNotFound {
		return nil, err
	}
	c := &domain.Channel{ID: id, WorkspaceID: ws, Kind: "dm", Members: []string{actorID, otherID}}
	if err := s.repo.CreateChannel(ctx, c); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "channels", "upsert", c, c.Members)
	return c, nil
}

type SendInput struct {
	ID        string  `json:"id"` // optional client-generated id
	ChannelID string  `json:"channelId"`
	Text      string  `json:"text"`
	ParentID  *string `json:"parentId"`
	ClipID    *string `json:"clipId"`
	CallID    *string `json:"callId"`
}

func (s *Service) Send(ctx context.Context, ws, actorID string, in SendInput) (*domain.Message, error) {
	text := strings.TrimSpace(in.Text)
	if text == "" || len(text) > 8000 {
		return nil, domain.ErrInvalidMessage
	}
	c, err := s.channelFor(ctx, ws, in.ChannelID, actorID)
	if err != nil {
		return nil, err
	}
	if in.ParentID != nil {
		parent, err := s.repo.GetMessage(ctx, ws, *in.ParentID)
		if err != nil {
			return nil, err
		}
		if parent.ChannelID != c.ID {
			return nil, apperror.Invalid("invalid_parent", "reply must be in the same channel")
		}
	}
	m := &domain.Message{ID: in.ID, ChannelID: c.ID, UserID: actorID, Text: text, ParentID: in.ParentID, ClipID: in.ClipID, CallID: in.CallID, Reactions: map[string][]string{}}
	if err := s.repo.CreateMessage(ctx, ws, m); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "messages", "upsert", m, audience(c))
	_ = s.repo.SetRead(ctx, c.ID, actorID, m.CreatedAt)

	preview := text
	if len(preview) > 120 {
		preview = preview[:117] + "…"
	}
	if c.Kind == "dm" {
		for _, r := range c.Members {
			s.safeNotify(ctx, ws, r, actorID, "sent you a message: “"+preview+"”", false)
		}
	} else {
		for _, r := range s.mentions.Mentioned(ctx, ws, text) {
			s.safeNotify(ctx, ws, r, actorID, "mentioned you in #"+c.Name+": “"+preview+"”", true)
		}
	}
	return m, nil
}

func (s *Service) safeNotify(ctx context.Context, ws, recipient, actor, text string, important bool) {
	if err := s.notify.Notify(ctx, ws, recipient, "mention", "", actor, text, important); err != nil {
		s.log.Warn("chat notify failed", zap.Error(err))
	}
}

func (s *Service) Edit(ctx context.Context, ws, actorID, id, text string) (*domain.Message, error) {
	text = strings.TrimSpace(text)
	if text == "" || len(text) > 8000 {
		return nil, domain.ErrInvalidMessage
	}
	m, err := s.repo.GetMessage(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if m.UserID != actorID {
		return nil, domain.ErrNotAuthor
	}
	c, err := s.repo.GetChannel(ctx, ws, m.ChannelID)
	if err != nil {
		return nil, err
	}
	m.Text, m.Edited = text, true
	if err := s.repo.UpdateMessage(ctx, ws, m); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "messages", "upsert", m, audience(c))
	return m, nil
}

func (s *Service) Delete(ctx context.Context, ws, actorID, id string) error {
	m, err := s.repo.GetMessage(ctx, ws, id)
	if err != nil {
		return err
	}
	if m.UserID != actorID {
		return domain.ErrNotAuthor
	}
	c, err := s.repo.GetChannel(ctx, ws, m.ChannelID)
	if err != nil {
		return err
	}
	ids, err := s.repo.DeleteMessage(ctx, ws, id)
	if err != nil {
		return err
	}
	for _, x := range ids {
		s.pub.Publish(ctx, ws, "messages", "delete", map[string]string{"id": x}, audience(c))
	}
	return nil
}

func (s *Service) ToggleReaction(ctx context.Context, ws, actorID, id, emoji string) (*domain.Message, error) {
	if emoji == "" || len(emoji) > 32 {
		return nil, apperror.Invalid("invalid_emoji", "invalid reaction")
	}
	m, err := s.repo.GetMessage(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	c, err := s.channelFor(ctx, ws, m.ChannelID, actorID)
	if err != nil {
		return nil, err
	}
	if m.Reactions == nil {
		m.Reactions = map[string][]string{}
	}
	users := m.Reactions[emoji]
	next := users[:0:0]
	had := false
	for _, u := range users {
		if u == actorID {
			had = true
			continue
		}
		next = append(next, u)
	}
	if !had {
		next = append(next, actorID)
	}
	if len(next) == 0 {
		delete(m.Reactions, emoji)
	} else {
		m.Reactions[emoji] = next
	}
	if err := s.repo.UpdateMessage(ctx, ws, m); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "messages", "upsert", m, audience(c))
	return m, nil
}

func (s *Service) MarkRead(ctx context.Context, ws, actorID, channelID string) error {
	if _, err := s.channelFor(ctx, ws, channelID, actorID); err != nil {
		return err
	}
	now := time.Now().UTC()
	if err := s.repo.SetRead(ctx, channelID, actorID, now); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "lastRead", "set", map[string]any{"channelId": channelID, "at": now}, []string{actorID})
	return nil
}

// ToTask creates a task from a message and links the two.
func (s *Service) ToTask(ctx context.Context, ws, actorID, messageID, taskID, listID string) (*domain.Message, error) {
	m, err := s.repo.GetMessage(ctx, ws, messageID)
	if err != nil {
		return nil, err
	}
	c, err := s.channelFor(ctx, ws, m.ChannelID, actorID)
	if err != nil {
		return nil, err
	}
	title := strings.Join(strings.Fields(m.Text), " ")
	if len(title) > 80 {
		title = title[:80]
	}
	taskID, err = s.tasks.CreateTaskFromText(ctx, ws, actorID, taskID, listID, title, m.Text)
	if err != nil {
		return nil, err
	}
	m.TaskID = &taskID
	if err := s.repo.UpdateMessage(ctx, ws, m); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "messages", "upsert", m, audience(c))
	return m, nil
}

// PostCallMessage announces a call in a channel (used by the meet context).
func (s *Service) PostCallMessage(ctx context.Context, ws, actorID, channelID, text, callID string) error {
	_, err := s.Send(ctx, ws, actorID, SendInput{ChannelID: channelID, Text: text, CallID: &callID})
	return err
}

// PostClipMessage shares a recorded clip in a channel (used by the media context).
func (s *Service) PostClipMessage(ctx context.Context, ws, actorID, channelID, text, clipID string) error {
	_, err := s.Send(ctx, ws, actorID, SendInput{ChannelID: channelID, Text: text, ClipID: &clipID})
	return err
}

// Snapshot returns channels the user can see, recent messages and read state.
func (s *Service) Snapshot(ctx context.Context, ws, userID string) (map[string]any, error) {
	all, err := s.repo.ListChannels(ctx, ws)
	if err != nil {
		return nil, err
	}
	memberIDs, err := s.members.MemberIDs(ctx, ws)
	if err != nil {
		return nil, err
	}
	visible := make([]domain.Channel, 0, len(all))
	ids := make([]string, 0, len(all))
	for _, c := range all {
		if !s.canSee(&c, userID) {
			continue
		}
		if c.Kind == "channel" {
			c.Members = memberIDs
		}
		visible = append(visible, c)
		ids = append(ids, c.ID)
	}
	msgs, err := s.repo.RecentMessages(ctx, ws, ids, 300)
	if err != nil {
		return nil, err
	}
	if msgs == nil {
		msgs = []domain.Message{}
	}
	read, err := s.repo.ReadState(ctx, ws, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"channels": visible, "messages": msgs, "lastRead": read}, nil
}
