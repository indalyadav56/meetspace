package domain

import "time"

type Channel struct {
	ID          string
	TeamID      string
	Name        string
	Description string
	Private     bool
	CreatedAt   time.Time
}
