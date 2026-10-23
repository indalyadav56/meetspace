package application

import (
	"context"
	"regexp"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Profile is the public view of a user shared with other contexts and clients.
type Profile struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Color string `json:"color"`
}

func toProfile(u domain.User) Profile {
	return Profile{ID: u.ID, Name: u.FullName, Email: u.Email, Color: u.Color}
}

type UserService struct {
	users domain.UserRepository
}

func NewUserService(users domain.UserRepository) *UserService { return &UserService{users: users} }

func (s *UserService) Me(ctx context.Context, id string) (Profile, error) {
	u, err := s.users.GetByID(ctx, id)
	if err != nil {
		return Profile{}, err
	}
	return toProfile(*u), nil
}

func (s *UserService) UpdateMe(ctx context.Context, id string, fullName, color *string) (Profile, error) {
	u, err := s.users.GetByID(ctx, id)
	if err != nil {
		return Profile{}, err
	}
	if fullName != nil {
		n := strings.TrimSpace(*fullName)
		if n == "" || len(n) > 255 {
			return Profile{}, apperror.Invalid("invalid_name", "name must be 1-255 characters")
		}
		u.FullName = n
	}
	if color != nil {
		if !hexColor.MatchString(*color) {
			return Profile{}, apperror.Invalid("invalid_color", "color must be #rrggbb")
		}
		u.Color = *color
	}
	if err := s.users.UpdateProfile(ctx, id, u.FullName, u.Color); err != nil {
		return Profile{}, err
	}
	return toProfile(*u), nil
}

// Profiles resolves user ids to public profiles (missing ids are skipped).
func (s *UserService) Profiles(ctx context.Context, ids []string) ([]Profile, error) {
	us, err := s.users.ListByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]Profile, 0, len(us))
	for _, u := range us {
		out = append(out, toProfile(u))
	}
	return out, nil
}

// FindOrInvite returns the user with this email, creating a placeholder account
// (unusable until they reset a password) when none exists; created reports
// which happened. Used by workspace invites.
func (s *UserService) FindOrInvite(ctx context.Context, email, name string) (id string, created bool, err error) {
	email = normalizeEmail(email)
	u, err := s.users.GetByEmail(ctx, email)
	if err == nil {
		return u.ID, false, nil
	}
	if err != domain.ErrUserNotFound {
		return "", false, err
	}
	if strings.TrimSpace(name) == "" {
		name = strings.Split(email, "@")[0]
	}
	raw, err := randomToken(24)
	if err != nil {
		return "", false, err
	}
	// Unusable random password; the invitee sets a real one via password reset.
	nu := &domain.User{Email: email, FullName: strings.TrimSpace(name), Color: colorFor(email), PasswordHash: "!invited:" + hashToken(raw), IsActive: true}
	if err := s.users.Create(ctx, nu); err != nil {
		return "", false, err
	}
	return nu.ID, true, nil
}
