// Package postgres implements the meet repository on PostgreSQL.
package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/meet/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/pgjson"
)

type Repository struct{ db *sql.DB }

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

type row interface{ Scan(...any) error }

func str(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	v := ns.String
	return &v
}

const mCols = `id, workspace_id, title, start_at, duration_min, attendees, kind, agenda, channel_id::text, task_id::text, notes_doc_id::text, COALESCE(created_by::text,'')`

func scanMeeting(r row) (*domain.Meeting, error) {
	var m domain.Meeting
	var ch, task, notes sql.NullString
	if err := r.Scan(&m.ID, &m.WorkspaceID, &m.Title, &m.Start, &m.DurationMin, pgjson.Scan(&m.Attendees), &m.Kind, &m.Agenda, &ch, &task, &notes, &m.CreatedBy); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrMeetingNotFound
		}
		return nil, err
	}
	m.ChannelID, m.TaskID, m.NotesDocID = str(ch), str(task), str(notes)
	if m.Attendees == nil {
		m.Attendees = []string{}
	}
	return &m, nil
}

func (r *Repository) CreateMeeting(ctx context.Context, m *domain.Meeting) error {
	return r.db.QueryRowContext(ctx, `INSERT INTO meet.meetings (id, workspace_id, title, start_at, duration_min, attendees, kind, agenda, channel_id, task_id, created_by)
		VALUES (COALESCE(NULLIF($11, '')::uuid, uuidv7()), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		m.WorkspaceID, m.Title, m.Start, m.DurationMin, pgjson.Value(m.Attendees), m.Kind, m.Agenda, m.ChannelID, m.TaskID, m.CreatedBy, m.ID).Scan(&m.ID)
}

func (r *Repository) GetMeeting(ctx context.Context, ws, id string) (*domain.Meeting, error) {
	return scanMeeting(r.db.QueryRowContext(ctx, `SELECT `+mCols+` FROM meet.meetings WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) ListMeetings(ctx context.Context, ws string) ([]domain.Meeting, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+mCols+` FROM meet.meetings WHERE workspace_id=$1 ORDER BY start_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Meeting
	for rows.Next() {
		m, err := scanMeeting(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateMeeting(ctx context.Context, m *domain.Meeting) error {
	_, err := r.db.ExecContext(ctx, `UPDATE meet.meetings SET title=$3, start_at=$4, duration_min=$5, attendees=$6, kind=$7, agenda=$8, channel_id=$9, task_id=$10, notes_doc_id=$11
		WHERE workspace_id=$1 AND id=$2`,
		m.WorkspaceID, m.ID, m.Title, m.Start, m.DurationMin, pgjson.Value(m.Attendees), m.Kind, m.Agenda, m.ChannelID, m.TaskID, m.NotesDocID)
	return err
}

func (r *Repository) DeleteMeeting(ctx context.Context, ws, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM meet.meetings WHERE workspace_id=$1 AND id=$2`, ws, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return domain.ErrMeetingNotFound
	}
	return nil
}

const cCols = `id, workspace_id, room, title, kind, channel_id::text, meeting_id::text, COALESCE(started_by::text,''), started_at, ended_at,
	participants, live_participants, recording_clip_id::text, notes_doc_id::text`

func scanCall(r row) (*domain.Call, error) {
	var c domain.Call
	var ch, meeting, rec, notes sql.NullString
	var ended sql.NullTime
	if err := r.Scan(&c.ID, &c.WorkspaceID, &c.Room, &c.Title, &c.Kind, &ch, &meeting, &c.StartedBy, &c.StartedAt, &ended,
		pgjson.Scan(&c.Participants), pgjson.Scan(&c.LiveParticipants), &rec, &notes); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrCallNotFound
		}
		return nil, err
	}
	c.ChannelID, c.MeetingID, c.RecordingClipID, c.NotesDocID = str(ch), str(meeting), str(rec), str(notes)
	if ended.Valid {
		c.EndedAt = &ended.Time
	}
	if c.Participants == nil {
		c.Participants = []string{}
	}
	if c.LiveParticipants == nil {
		c.LiveParticipants = []string{}
	}
	return &c, nil
}

func (r *Repository) CreateCall(ctx context.Context, c *domain.Call) error {
	c.Room = "ms-" + uuid.NewString()
	return r.db.QueryRowContext(ctx, `INSERT INTO meet.calls (workspace_id, room, title, kind, channel_id, meeting_id, started_by, participants, live_participants)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, started_at`,
		c.WorkspaceID, c.Room, c.Title, c.Kind, c.ChannelID, c.MeetingID, c.StartedBy, pgjson.Value(c.Participants), pgjson.Value(c.LiveParticipants)).Scan(&c.ID, &c.StartedAt)
}

func (r *Repository) GetCall(ctx context.Context, ws, id string) (*domain.Call, error) {
	return scanCall(r.db.QueryRowContext(ctx, `SELECT `+cCols+` FROM meet.calls WHERE workspace_id=$1 AND id=$2`, ws, id))
}

func (r *Repository) GetCallByRoom(ctx context.Context, room string) (*domain.Call, error) {
	return scanCall(r.db.QueryRowContext(ctx, `SELECT `+cCols+` FROM meet.calls WHERE room=$1`, room))
}

func (r *Repository) ActiveCallForMeeting(ctx context.Context, ws, meetingID string) (*domain.Call, error) {
	return scanCall(r.db.QueryRowContext(ctx, `SELECT `+cCols+` FROM meet.calls WHERE workspace_id=$1 AND meeting_id=$2 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`, ws, meetingID))
}

func (r *Repository) ListCalls(ctx context.Context, ws string, limit int) ([]domain.Call, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+cCols+` FROM meet.calls WHERE workspace_id=$1 ORDER BY started_at DESC LIMIT $2`, ws, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Call
	for rows.Next() {
		c, err := scanCall(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateCall(ctx context.Context, c *domain.Call) error {
	_, err := r.db.ExecContext(ctx, `UPDATE meet.calls SET ended_at=$3, participants=$4, live_participants=$5, recording_clip_id=$6, notes_doc_id=$7 WHERE workspace_id=$1 AND id=$2`,
		c.WorkspaceID, c.ID, c.EndedAt, pgjson.Value(c.Participants), pgjson.Value(c.LiveParticipants), c.RecordingClipID, c.NotesDocID)
	return err
}
