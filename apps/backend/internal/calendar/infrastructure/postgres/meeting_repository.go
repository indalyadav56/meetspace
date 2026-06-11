package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/indalyadav56/meetspace/backend/internal/calendar/domain"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

const meetingCols = `id, title, description, organizer_id, attendee_ids, channel_id, starts_at, ends_at, created_at`

func (r *Repository) List(ctx context.Context, f domain.ListFilter) ([]domain.Meeting, error) {
	query := `SELECT ` + meetingCols + ` FROM meetings WHERE 1=1`
	args := []any{}
	if !f.From.IsZero() {
		args = append(args, f.From)
		query += fmt.Sprintf(" AND ends_at >= $%d", len(args))
	}
	if !f.To.IsZero() {
		args = append(args, f.To)
		query += fmt.Sprintf(" AND starts_at <= $%d", len(args))
	}
	query += ` ORDER BY starts_at`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var meetings []domain.Meeting
	for rows.Next() {
		m, err := scanMeeting(rows)
		if err != nil {
			return nil, err
		}
		meetings = append(meetings, *m)
	}
	return meetings, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id string) (*domain.Meeting, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+meetingCols+` FROM meetings WHERE id = $1`, id)
	m, err := scanMeeting(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrMeetingNotFound
	}
	return m, err
}

func (r *Repository) Create(ctx context.Context, m *domain.Meeting) error {
	attendees, err := json.Marshal(m.AttendeeIDs)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO meetings (id, title, description, organizer_id, attendee_ids, channel_id, starts_at, ends_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		m.ID, m.Title, m.Description, m.OrganizerID, attendees, m.ChannelID,
		m.StartsAt, m.EndsAt, m.CreatedAt)
	return err
}

type rowScanner interface{ Scan(dest ...any) error }

func scanMeeting(row rowScanner) (*domain.Meeting, error) {
	var m domain.Meeting
	var attendees []byte
	var channel sql.NullString
	err := row.Scan(&m.ID, &m.Title, &m.Description, &m.OrganizerID, &attendees,
		&channel, &m.StartsAt, &m.EndsAt, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	if channel.Valid {
		m.ChannelID = &channel.String
	}
	if err := json.Unmarshal(attendees, &m.AttendeeIDs); err != nil {
		return nil, err
	}
	return &m, nil
}
