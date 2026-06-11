package domain

import "time"

type Presence string

const (
	PresenceAvailable Presence = "available"
	PresenceBusy      Presence = "busy"
	PresenceAway      Presence = "away"
	PresenceDND       Presence = "dnd"
	PresenceOffline   Presence = "offline"
)

type User struct {
	ID            string
	Name          string
	Email         string
	Initials      string
	Color         string
	Role          string
	Presence      Presence
	StatusMessage string
	CreatedAt     time.Time
}
