// Package application implements meetings and calls.
package application

import (
	"context"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/meet/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

type Members interface {
	IsMember(ctx context.Context, workspaceID, userID string) (bool, error)
}

type UserNames interface {
	DisplayName(ctx context.Context, userID string) string
}

// CallAnnouncer posts "started a call" messages into chat.
type CallAnnouncer interface {
	PostCallMessage(ctx context.Context, workspaceID, actorID, channelID, text, callID string) error
}

type Service struct {
	repo     domain.Repository
	rooms    domain.RoomAccess // nil when LiveKit isn't configured
	pub      Publisher
	members  Members
	names    UserNames
	announce CallAnnouncer
	tokenTTL time.Duration
	log      *zap.Logger
}

func NewService(repo domain.Repository, rooms domain.RoomAccess, pub Publisher, members Members, names UserNames, announce CallAnnouncer, tokenTTL time.Duration, log *zap.Logger) *Service {
	if tokenTTL <= 0 {
		tokenTTL = 6 * time.Hour
	}
	return &Service{repo: repo, rooms: rooms, pub: pub, members: members, names: names, announce: announce, tokenTTL: tokenTTL, log: log}
}

func (s *Service) requireMembers(ctx context.Context, ws string, ids []string) error {
	for _, id := range ids {
		ok, err := s.members.IsMember(ctx, ws, id)
		if err != nil {
			return err
		}
		if !ok {
			return apperror.Invalid("not_a_member", "every attendee must be a member of this workspace")
		}
	}
	return nil
}

// ---- meetings

type MeetingInput struct {
	ID          string    `json:"id"` // optional client-generated id
	Title       string    `json:"title"`
	Start       time.Time `json:"start"`
	DurationMin int       `json:"durationMin"`
	Attendees   []string  `json:"attendees"`
	Kind        string    `json:"kind"`
	Agenda      string    `json:"agenda"`
	ChannelID   *string   `json:"channelId"`
	TaskID      *string   `json:"taskId"`
	NotesDocID  *string   `json:"notesDocId"`
}

func (in *MeetingInput) validate() error {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" || len(in.Title) > 200 {
		return apperror.Invalid("invalid_title", "title must be 1-200 characters")
	}
	if in.DurationMin <= 0 || in.DurationMin > 24*60 {
		return apperror.Invalid("invalid_duration", "duration must be between 1 minute and 24 hours")
	}
	if in.Kind != "video" && in.Kind != "audio" {
		return apperror.Invalid("invalid_kind", "kind must be video or audio")
	}
	if in.Start.IsZero() {
		return apperror.Invalid("invalid_start", "start time is required")
	}
	return nil
}

func emptyToNil(p *string) *string {
	if p == nil || *p == "" {
		return nil
	}
	return p
}

func (s *Service) CreateMeeting(ctx context.Context, ws, actorID string, in MeetingInput) (*domain.Meeting, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	if err := s.requireMembers(ctx, ws, in.Attendees); err != nil {
		return nil, err
	}
	m := &domain.Meeting{ID: in.ID, WorkspaceID: ws, Title: in.Title, Start: in.Start, DurationMin: in.DurationMin, Attendees: in.Attendees, Kind: in.Kind, Agenda: in.Agenda,
		ChannelID: emptyToNil(in.ChannelID), TaskID: emptyToNil(in.TaskID), CreatedBy: actorID}
	if err := s.repo.CreateMeeting(ctx, m); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "meetings", "upsert", m, nil)
	return m, nil
}

func (s *Service) UpdateMeeting(ctx context.Context, ws, id string, in MeetingInput) (*domain.Meeting, error) {
	m, err := s.repo.GetMeeting(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if err := in.validate(); err != nil {
		return nil, err
	}
	if err := s.requireMembers(ctx, ws, in.Attendees); err != nil {
		return nil, err
	}
	m.Title, m.Start, m.DurationMin, m.Attendees, m.Kind, m.Agenda = in.Title, in.Start, in.DurationMin, in.Attendees, in.Kind, in.Agenda
	m.ChannelID, m.TaskID = emptyToNil(in.ChannelID), emptyToNil(in.TaskID)
	if in.NotesDocID != nil {
		m.NotesDocID = emptyToNil(in.NotesDocID)
	}
	if err := s.repo.UpdateMeeting(ctx, m); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "meetings", "upsert", m, nil)
	return m, nil
}

func (s *Service) DeleteMeeting(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteMeeting(ctx, ws, id); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "meetings", "delete", map[string]string{"id": id}, nil)
	return nil
}

// ---- calls

// JoinInfo is everything a client needs to connect to the media room.
type JoinInfo struct {
	Call  *domain.Call `json:"call"`
	Token string       `json:"token"`
	URL   string       `json:"url"`
}

type StartInput struct {
	Title     string   `json:"title"`
	Kind      string   `json:"kind"`
	ChannelID *string  `json:"channelId"`
	MeetingID *string  `json:"meetingId"`
	Invitees  []string `json:"invitees"`
}

func (s *Service) join(ctx context.Context, c *domain.Call, actorID string) (*JoinInfo, error) {
	tok, err := s.rooms.Token(c.Room, actorID, s.names.DisplayName(ctx, actorID), s.tokenTTL)
	if err != nil {
		return nil, err
	}
	return &JoinInfo{Call: c, Token: tok, URL: s.rooms.ClientURL()}, nil
}

// StartCall opens a new room (or rejoins a scheduled meeting's open call),
// rings the invitees and announces it in the channel.
func (s *Service) StartCall(ctx context.Context, ws, actorID string, in StartInput) (*JoinInfo, error) {
	if s.rooms == nil {
		return nil, domain.ErrMeetUnavailable
	}
	if in.Kind != "video" && in.Kind != "audio" {
		return nil, apperror.Invalid("invalid_kind", "kind must be video or audio")
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = s.names.DisplayName(ctx, actorID) + "’s meeting"
	}
	if len(title) > 200 {
		title = title[:200]
	}
	in.MeetingID = emptyToNil(in.MeetingID)
	in.ChannelID = emptyToNil(in.ChannelID)
	if in.MeetingID != nil {
		if open, err := s.repo.ActiveCallForMeeting(ctx, ws, *in.MeetingID); err == nil {
			return s.join(ctx, open, actorID)
		}
	}
	c := &domain.Call{WorkspaceID: ws, Title: title, Kind: in.Kind, ChannelID: in.ChannelID, MeetingID: in.MeetingID, StartedBy: actorID, Participants: []string{}, LiveParticipants: []string{}}
	if err := s.repo.CreateCall(ctx, c); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "callLogs", "upsert", c, nil)

	invitees := make([]string, 0, len(in.Invitees))
	for _, id := range in.Invitees {
		if id != actorID {
			invitees = append(invitees, id)
		}
	}
	if len(invitees) > 0 {
		s.pub.Publish(ctx, ws, "calls", "ring", map[string]any{"call": c, "from": actorID}, invitees)
	}
	if c.ChannelID != nil {
		if err := s.announce.PostCallMessage(ctx, ws, actorID, *c.ChannelID, "Started a "+c.Kind+" call", c.Room); err != nil {
			s.log.Warn("call announcement failed", zap.Error(err))
		}
	}
	return s.join(ctx, c, actorID)
}

// JoinCall returns a token for an existing, unfinished call.
func (s *Service) JoinCall(ctx context.Context, ws, actorID, id string) (*JoinInfo, error) {
	if s.rooms == nil {
		return nil, domain.ErrMeetUnavailable
	}
	c, err := s.repo.GetCall(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if c.EndedAt != nil {
		return nil, domain.ErrCallEnded
	}
	return s.join(ctx, c, actorID)
}

// Ring invites more people into a running call.
func (s *Service) Ring(ctx context.Context, ws, actorID, id string, userIDs []string) error {
	c, err := s.repo.GetCall(ctx, ws, id)
	if err != nil {
		return err
	}
	if c.EndedAt != nil {
		return domain.ErrCallEnded
	}
	if err := s.requireMembers(ctx, ws, userIDs); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "calls", "ring", map[string]any{"call": c, "from": actorID}, userIDs)
	return nil
}

// Decline tells the caller that the invitee won't join.
func (s *Service) Decline(ctx context.Context, ws, actorID, id string) error {
	c, err := s.repo.GetCall(ctx, ws, id)
	if err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "calls", "decline", map[string]any{"callId": c.ID, "userId": actorID}, []string{c.StartedBy})
	return nil
}

type CallPatch struct {
	RecordingClipID *string `json:"recordingClipId"`
	NotesDocID      *string `json:"notesDocId"`
}

func (s *Service) UpdateCall(ctx context.Context, ws, id string, p CallPatch) (*domain.Call, error) {
	c, err := s.repo.GetCall(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.RecordingClipID != nil {
		c.RecordingClipID = emptyToNil(p.RecordingClipID)
	}
	if p.NotesDocID != nil {
		c.NotesDocID = emptyToNil(p.NotesDocID)
		if c.MeetingID != nil {
			if m, err := s.repo.GetMeeting(ctx, ws, *c.MeetingID); err == nil {
				m.NotesDocID = c.NotesDocID
				if err := s.repo.UpdateMeeting(ctx, m); err == nil {
					s.pub.Publish(ctx, ws, "meetings", "upsert", m, nil)
				}
			}
		}
	}
	if err := s.repo.UpdateCall(ctx, c); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "callLogs", "upsert", c, nil)
	return c, nil
}

// EndCall closes the room for everyone. Only the person who started it may end it.
func (s *Service) EndCall(ctx context.Context, ws, actorID, id string) error {
	c, err := s.repo.GetCall(ctx, ws, id)
	if err != nil {
		return err
	}
	if c.StartedBy != actorID {
		return apperror.Forbidden("not_host", "only the host can end the call for everyone")
	}
	if s.rooms != nil {
		if err := s.rooms.DeleteRoom(ctx, c.Room); err != nil {
			s.log.Warn("delete livekit room failed", zap.Error(err))
		}
	}
	return s.finish(ctx, c)
}

func (s *Service) finish(ctx context.Context, c *domain.Call) error {
	if c.EndedAt != nil {
		return nil
	}
	now := time.Now().UTC()
	c.EndedAt, c.LiveParticipants = &now, []string{}
	if err := s.repo.UpdateCall(ctx, c); err != nil {
		return err
	}
	s.pub.Publish(ctx, c.WorkspaceID, "callLogs", "upsert", c, nil)
	return nil
}

// HandleRoomEvent applies a verified LiveKit webhook event to the matching call.
func (s *Service) HandleRoomEvent(ctx context.Context, event, room, identity string) error {
	c, err := s.repo.GetCallByRoom(ctx, room)
	if err == domain.ErrCallNotFound {
		return nil // a room we don't track
	}
	if err != nil {
		return err
	}
	switch event {
	case "participant_joined":
		if !has(c.LiveParticipants, identity) {
			c.LiveParticipants = append(c.LiveParticipants, identity)
		}
		if !has(c.Participants, identity) {
			c.Participants = append(c.Participants, identity)
		}
		c.EndedAt = nil
	case "participant_left":
		c.LiveParticipants = without(c.LiveParticipants, identity)
	case "room_finished":
		return s.finish(ctx, c)
	default:
		return nil
	}
	if err := s.repo.UpdateCall(ctx, c); err != nil {
		return err
	}
	s.pub.Publish(ctx, c.WorkspaceID, "callLogs", "upsert", c, nil)
	return nil
}

func has(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func without(xs []string, x string) []string {
	out := make([]string, 0, len(xs))
	for _, v := range xs {
		if v != x {
			out = append(out, v)
		}
	}
	return out
}

func (s *Service) Snapshot(ctx context.Context, ws, _ string) (map[string]any, error) {
	ms, err := s.repo.ListMeetings(ctx, ws)
	if err != nil {
		return nil, err
	}
	cs, err := s.repo.ListCalls(ctx, ws, 100)
	if err != nil {
		return nil, err
	}
	if ms == nil {
		ms = []domain.Meeting{}
	}
	if cs == nil {
		cs = []domain.Call{}
	}
	return map[string]any{"meetings": ms, "callLogs": cs, "meetEnabled": s.rooms != nil}, nil
}
