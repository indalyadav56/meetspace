package application

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
)

// PolicyVersion names the current Privacy Policy and Terms. Bump it when either
// changes and everyone is asked to accept the new version on their next visit.
const PolicyVersion = "2026-10-29"

// Consent is what the person agreed to, for the consent prompt and their data export.
type Consent struct {
	Version    string     `json:"version"`
	AcceptedAt *time.Time `json:"acceptedAt"`
	Current    string     `json:"current"`
	// Required is true until they accept the current version.
	Required bool `json:"required"`
}

func consentOf(u *domain.User) Consent {
	return Consent{Version: u.ConsentVersion, AcceptedAt: u.ConsentedAt, Current: PolicyVersion, Required: u.ConsentVersion != PolicyVersion}
}

func (s *UserService) Consent(ctx context.Context, id string) (Consent, error) {
	u, err := s.users.GetByID(ctx, id)
	if err != nil {
		return Consent{}, err
	}
	return consentOf(u), nil
}

// AcceptPolicy records that the person agreed to version, which must be the current one.
func (s *UserService) AcceptPolicy(ctx context.Context, id, version string) (Consent, error) {
	if version != PolicyVersion {
		return Consent{}, domain.ErrOldPolicy
	}
	u, err := s.users.GetByID(ctx, id)
	if err != nil {
		return Consent{}, err
	}
	now := time.Now().UTC()
	if err := s.users.SetConsent(ctx, id, version, now); err != nil {
		return Consent{}, err
	}
	u.ConsentVersion, u.ConsentedAt = version, &now
	return consentOf(u), nil
}

// AccountData is the identity part of a personal data export.
type AccountData struct {
	Profile   Profile           `json:"profile"`
	CreatedAt time.Time         `json:"createdAt"`
	LastLogin *time.Time        `json:"lastLoginAt"`
	TwoFactor bool              `json:"twoFactorEnabled"`
	Consent   Consent           `json:"consent"`
	SignIns   []domain.Identity `json:"singleSignOn"`
	Sessions  []domain.Session  `json:"sessions"`
}

func (s *AuthService) AccountData(ctx context.Context, userID string) (AccountData, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return AccountData{}, err
	}
	out := AccountData{Profile: toProfile(*u), CreatedAt: u.CreatedAt, LastLogin: u.LastLoginAt, TwoFactor: u.TOTPEnabled, Consent: consentOf(u)}
	if out.SignIns, err = s.LinkedAccounts(ctx, userID); err != nil {
		return AccountData{}, err
	}
	if out.Sessions, err = s.tokens.Sessions(ctx, userID); err != nil {
		return AccountData{}, err
	}
	return out, nil
}

// ConfirmErase checks the person really means to delete their account: their
// password, or their email typed out when they have no password (single sign-on).
func (s *AuthService) ConfirmErase(ctx context.Context, userID, password, email string) error {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if hasPassword(u) {
		if password == "" || s.hasher.Compare(u.PasswordHash, password) != nil {
			return domain.ErrErasePassword
		}
		return nil
	}
	if normalizeEmail(email) != u.Email {
		return domain.ErrEraseEmail
	}
	return nil
}

// Erase anonymises the account and ends every session.
func (s *AuthService) Erase(ctx context.Context, userID string) error {
	return s.users.Erase(ctx, userID)
}
