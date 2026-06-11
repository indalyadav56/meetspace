package domain

import "time"

type Meeting struct {
	ID          string
	Title       string
	Description string
	OrganizerID string
	AttendeeIDs []string
	ChannelID   *string
	StartsAt    time.Time
	EndsAt      time.Time
	CreatedAt   time.Time
}
