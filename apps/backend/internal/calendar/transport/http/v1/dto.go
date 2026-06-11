package v1

import (
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/calendar/domain"
)

type MeetingResponse struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	OrganizerID string    `json:"organizerId"`
	AttendeeIDs []string  `json:"attendeeIds"`
	ChannelID   *string   `json:"channelId"`
	StartsAt    time.Time `json:"startsAt"`
	EndsAt      time.Time `json:"endsAt"`
	CreatedAt   time.Time `json:"createdAt"`
}

func toMeetingResponse(m *domain.Meeting) MeetingResponse {
	attendees := m.AttendeeIDs
	if attendees == nil {
		attendees = []string{}
	}
	return MeetingResponse{
		ID:          m.ID,
		Title:       m.Title,
		Description: m.Description,
		OrganizerID: m.OrganizerID,
		AttendeeIDs: attendees,
		ChannelID:   m.ChannelID,
		StartsAt:    m.StartsAt,
		EndsAt:      m.EndsAt,
		CreatedAt:   m.CreatedAt,
	}
}

type CreateMeetingRequest struct {
	Title       string    `json:"title" binding:"required"`
	Description string    `json:"description"`
	OrganizerID string    `json:"organizerId" binding:"required"`
	AttendeeIDs []string  `json:"attendeeIds"`
	ChannelID   *string   `json:"channelId"`
	StartsAt    time.Time `json:"startsAt" binding:"required"`
	EndsAt      time.Time `json:"endsAt" binding:"required"`
}
