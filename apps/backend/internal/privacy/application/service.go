// Package application implements people's rights over their personal data
// (India's DPDP Act): getting a copy of it, and erasing their account.
package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// Account is the identity context: the account itself and how to erase it.
type Account interface {
	AccountData(ctx context.Context, userID string) (any, error)
	ConfirmErase(ctx context.Context, userID, password, email string) error
	Erase(ctx context.Context, userID string) error
}

// Membership is one workspace the person belongs to.
type Membership struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Role    string `json:"role"`
	Members int    `json:"members"`
	Owners  int    `json:"owners"`
}

// Workspaces is the workspace context.
type Workspaces interface {
	Memberships(ctx context.Context, userID string) ([]Membership, error)
	Leave(ctx context.Context, workspaceID, userID string) error
	Delete(ctx context.Context, workspaceID, userID string) error
}

// Activity is the person's own security activity from the audit log.
type Activity interface {
	Mine(ctx context.Context, userID string) (any, error)
}

// Repository reads and removes personal data spread across the other contexts' tables.
type Repository interface {
	// Content is what the person wrote or set up: tasks, comments, messages, docs, time and settings.
	Content(ctx context.Context, userID string) (map[string]any, error)
	// Forget deletes rows that only matter to the person (devices, preferences, feeds, reminders).
	Forget(ctx context.Context, userID string) error
}

// Contact is the grievance officer people can complain to, as the DPDP Act requires.
type Contact struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Address string `json:"address,omitempty"`
}

type Service struct {
	account    Account
	workspaces Workspaces
	activity   Activity
	repo       Repository
	contact    Contact
	now        func() time.Time
}

func NewService(account Account, workspaces Workspaces, activity Activity, repo Repository, contact Contact) *Service {
	return &Service{account: account, workspaces: workspaces, activity: activity, repo: repo, contact: contact, now: time.Now}
}

func (s *Service) Contact() Contact { return s.contact }

// Export gathers everything we hold about the person into one document.
func (s *Service) Export(ctx context.Context, userID string) (map[string]any, error) {
	account, err := s.account.AccountData(ctx, userID)
	if err != nil {
		return nil, err
	}
	ms, err := s.workspaces.Memberships(ctx, userID)
	if err != nil {
		return nil, err
	}
	content, err := s.repo.Content(ctx, userID)
	if err != nil {
		return nil, err
	}
	activity, err := s.activity.Mine(ctx, userID)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"exportedAt":       s.now().UTC(),
		"account":          account,
		"workspaces":       ms,
		"content":          content,
		"securityActivity": activity,
		"grievanceOfficer": s.contact,
	}, nil
}

// ErrSoleOwner stops a deletion that would leave a shared workspace without an owner.
func errSoleOwner(names []string) error {
	return apperror.Conflict("sole_owner", fmt.Sprintf("You're the only owner of %s. Make someone else an owner (or delete the workspace) first.", strings.Join(names, ", ")))
}

// Blockers lists shared workspaces the person must hand over before deleting their account.
func Blockers(ms []Membership) []string {
	var names []string
	for _, m := range ms {
		if m.Role == "owner" && m.Owners < 2 && m.Members > 1 {
			names = append(names, m.Name)
		}
	}
	return names
}

// Delete erases the person's account: workspaces only they use are deleted,
// they leave the rest, personal settings are removed and the account is
// anonymised. What they wrote in shared workspaces stays, as "Deleted user".
func (s *Service) Delete(ctx context.Context, userID, password, email string) error {
	if err := s.account.ConfirmErase(ctx, userID, password, email); err != nil {
		return err
	}
	ms, err := s.workspaces.Memberships(ctx, userID)
	if err != nil {
		return err
	}
	if names := Blockers(ms); len(names) > 0 {
		return errSoleOwner(names)
	}
	for _, m := range ms {
		if m.Members <= 1 {
			err = s.workspaces.Delete(ctx, m.ID, userID)
		} else {
			err = s.workspaces.Leave(ctx, m.ID, userID)
		}
		if err != nil {
			return fmt.Errorf("leaving %s: %w", m.Name, err)
		}
	}
	if err := s.repo.Forget(ctx, userID); err != nil {
		return err
	}
	return s.account.Erase(ctx, userID)
}
