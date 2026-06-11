package domain

import (
	"regexp"
	"time"
)

var keyPattern = regexp.MustCompile(`^[A-Z]{2,6}$`)

type Team struct {
	ID          string
	Name        string
	Key         string // short slug used to build task keys, e.g. "ENG"
	Description string
	Color       string
	Icon        string
	LeadID      string
	MemberIDs   []string
	CreatedAt   time.Time
}

// ValidateKey enforces the business rule for team keys (ENG, DSGN, ...).
func ValidateKey(key string) error {
	if !keyPattern.MatchString(key) {
		return ErrInvalidTeamKey
	}
	return nil
}
