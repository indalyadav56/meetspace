// Package domain holds scheduled meetings and calls (LiveKit rooms).
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Meeting struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	Title       string    `json:"title"`
	Start       time.Time `json:"start"`
	DurationMin int       `json:"durationMin"`
	Attendees   []string  `json:"attendees"`
	Kind        string    `json:"kind"`
	Agenda      string    `json:"agenda"`
	ChannelID   *string   `json:"channelId"`
	TaskID      *string   `json:"taskId"`
	NotesDocID  *string   `json:"notesDocId"`
	CreatedBy   string    `json:"createdBy"`
}

// Call is one LiveKit room session. Room is the id clients join by.
type Call struct {
	ID               string     `json:"id"`
	WorkspaceID      string     `json:"-"`
	Room             string     `json:"callId"`
	Title            string     `json:"title"`
	Kind             string     `json:"kind"`
	ChannelID        *string    `json:"channelId"`
	MeetingID        *string    `json:"meetingId"`
	StartedBy        string     `json:"startedBy"`
	StartedAt        time.Time  `json:"startedAt"`
	EndedAt          *time.Time `json:"endedAt"`
	Participants     []string   `json:"participants"`
	LiveParticipants []string   `json:"liveParticipants"`
	RecordingClipID  *string    `json:"recordingClipId"`
	NotesDocID       *string    `json:"notesDocId"`
}

var (
	ErrMeetingNotFound = apperror.NotFound("meeting_not_found", "meeting not found")
	ErrCallNotFound    = apperror.NotFound("call_not_found", "call not found")
	ErrCallEnded       = apperror.Conflict("call_ended", "this call has ended")
	ErrMeetUnavailable = apperror.Unavailable("meetings_unavailable", "the meeting server is not configured")
)

type Repository interface {
	CreateMeeting(ctx context.Context, m *Meeting) error
	GetMeeting(ctx context.Context, ws, id string) (*Meeting, error)
	ListMeetings(ctx context.Context, ws string) ([]Meeting, error)
	UpdateMeeting(ctx context.Context, m *Meeting) error
	DeleteMeeting(ctx context.Context, ws, id string) error

	CreateCall(ctx context.Context, c *Call) error
	GetCall(ctx context.Context, ws, id string) (*Call, error)
	GetCallByRoom(ctx context.Context, room string) (*Call, error)
	// ActiveCallForMeeting returns the open call of a scheduled meeting, if any.
	ActiveCallForMeeting(ctx context.Context, ws, meetingID string) (*Call, error)
	ListCalls(ctx context.Context, ws string, limit int) ([]Call, error)
	UpdateCall(ctx context.Context, c *Call) error
}

// RoomAccess issues join tokens for, and administers, media rooms.
type RoomAccess interface {
	Token(room, identity, name string, ttl time.Duration) (string, error)
	ClientURL() string
	DeleteRoom(ctx context.Context, room string) error
}
