package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/secretbox"
	"github.com/indalyadav56/meetspace/backend/pkg/totp"
)

type memIdentities struct{ links map[string]string }

func (m *memIdentities) FindUser(_ context.Context, provider, subject string) (string, error) {
	if id, ok := m.links[provider+"|"+subject]; ok {
		return id, nil
	}
	return "", domain.ErrUserNotFound
}
func (m *memIdentities) Link(_ context.Context, userID, provider, subject, _ string) error {
	m.links[provider+"|"+subject] = userID
	return nil
}
func (m *memIdentities) ForUser(context.Context, string) ([]domain.Identity, error) { return nil, nil }

func secureAuth(t *testing.T) *AuthService {
	a, _ := newAuth()
	box, err := secretbox.FromPassphrase("test-secret")
	if err != nil {
		t.Fatal(err)
	}
	a.EnableSecurity(box, []byte("k"), &memIdentities{links: map[string]string{}})
	return a
}

func TestTwoFactorSignIn(t *testing.T) {
	ctx := context.Background()
	a := secureAuth(t)
	u, _, _ := a.Register(ctx, "ann@example.com", "Ann", "correct-horse")

	secret, url, err := a.SetupTOTP(ctx, u.ID)
	if err != nil || secret == "" || url == "" {
		t.Fatalf("setup: %v", err)
	}
	if _, err := a.EnableTOTP(ctx, u.ID, "000000"); !errors.Is(err, domain.ErrBadCode) {
		t.Fatalf("a wrong first code must not enable 2FA, got %v", err)
	}
	code, _ := totp.Code(secret, time.Now())
	recovery, err := a.EnableTOTP(ctx, u.ID, code)
	if err != nil || len(recovery) != recoveryCount {
		t.Fatalf("enable: %v (%d codes)", err, len(recovery))
	}

	// Password alone now stops at the second factor.
	_, pair, err := a.Login(ctx, "ann@example.com", "correct-horse")
	var mfa *MFARequired
	if !errors.As(err, &mfa) || pair != nil {
		t.Fatalf("login should ask for a code, got %v", err)
	}
	if _, _, _, err := a.CompleteMFA(ctx, mfa.Token, "123456"); !errors.Is(err, domain.ErrBadCode) {
		t.Fatalf("bad code: %v", err)
	}
	if _, _, _, err := a.CompleteMFA(ctx, "forged.token", code); err == nil {
		t.Fatal("a forged token must fail")
	}
	if _, pair, used, err := a.CompleteMFA(ctx, mfa.Token, code); err != nil || pair == nil || used {
		t.Fatalf("totp: %v", err)
	}

	// A recovery code works exactly once.
	if _, _, used, err := a.CompleteMFA(ctx, mfa.Token, recovery[0]); err != nil || !used {
		t.Fatalf("recovery: %v", err)
	}
	if _, _, _, err := a.CompleteMFA(ctx, mfa.Token, recovery[0]); !errors.Is(err, domain.ErrBadCode) {
		t.Fatalf("a spent recovery code must fail, got %v", err)
	}
	if st, _ := a.TwoFactor(ctx, u.ID); !st.Enabled || st.RecoveryLeft != recoveryCount-1 {
		t.Fatalf("status: %+v", st)
	}

	// Turning it off needs the password and a code.
	if err := a.DisableTOTP(ctx, u.ID, "wrong", code); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("disable with wrong password: %v", err)
	}
	if err := a.DisableTOTP(ctx, u.ID, "correct-horse", code); err != nil {
		t.Fatal(err)
	}
	if _, pair, err := a.Login(ctx, "ann@example.com", "correct-horse"); err != nil || pair == nil {
		t.Fatalf("login after disabling: %v", err)
	}
}

func TestMFATokenExpires(t *testing.T) {
	a := secureAuth(t)
	tok := a.sign("mfa", "u1", time.Minute)
	a.now = func() time.Time { return time.Now().Add(2 * time.Minute) }
	if _, err := a.verify("mfa", tok); !errors.Is(err, domain.ErrMFAExpired) {
		t.Fatalf("expired: %v", err)
	}
	if _, err := a.verify("oauth", tok); err == nil {
		t.Fatal("a token of one kind must not pass as another")
	}
}

func TestSSOLinksByVerifiedEmail(t *testing.T) {
	ctx := context.Background()
	a := secureAuth(t)
	existing, _, _ := a.Register(ctx, "ann@example.com", "Ann", "correct-horse")

	if _, _, _, err := a.SSOLogin(ctx, SSOProfile{Provider: "google", Subject: "g1", Email: "ann@example.com"}); !errors.Is(err, domain.ErrSSOUnverified) {
		t.Fatalf("an unverified email must not take over an account, got %v", err)
	}
	u, pair, created, err := a.SSOLogin(ctx, SSOProfile{Provider: "google", Subject: "g1", Email: "Ann@Example.com", EmailVerified: true})
	if err != nil || created || u.ID != existing.ID || pair == nil {
		t.Fatalf("link: %v created=%v", err, created)
	}
	// Next time the link is used even if the provider's email changed.
	if u2, _, _, err := a.SSOLogin(ctx, SSOProfile{Provider: "google", Subject: "g1", Email: "new@example.com"}); err != nil || u2.ID != existing.ID {
		t.Fatalf("relink: %v", err)
	}
	nu, _, created, err := a.SSOLogin(ctx, SSOProfile{Provider: "oidc", Subject: "o9", Email: "bo@example.com", Name: "Bo", EmailVerified: true})
	if err != nil || !created || nu.FullName != "Bo" {
		t.Fatalf("new account: %v", err)
	}
	if _, _, err := a.Login(ctx, "bo@example.com", ""); err == nil {
		t.Fatal("an SSO-only account must not accept a password")
	}
}

func TestRevokeOtherSessions(t *testing.T) {
	ctx := WithClient(context.Background(), "10.0.0.1", "Firefox")
	a, toks := newAuth()
	u, _, _ := a.Register(ctx, "ann@example.com", "Ann", "correct-horse")
	_, _, _ = a.Login(ctx, "ann@example.com", "correct-horse")
	list, _ := a.Sessions(ctx, u.ID, toks.list[0].SessionID)
	if len(list) != 2 || !list[0].Current || list[0].UserAgent != "Firefox" {
		t.Fatalf("sessions: %+v", list)
	}
	if n, err := a.RevokeOtherSessions(ctx, u.ID, toks.list[0].SessionID); err != nil || n != 1 {
		t.Fatalf("revoke: %d %v", n, err)
	}
	if list, _ := a.Sessions(ctx, u.ID, ""); len(list) != 1 {
		t.Fatalf("one session should remain, got %d", len(list))
	}
}
