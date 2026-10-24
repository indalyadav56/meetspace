package application

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/identity/domain"
)

// In-memory fakes for the identity repositories.

type memUsers struct{ byID map[string]*domain.User }

func (m *memUsers) Create(_ context.Context, u *domain.User) error {
	for _, x := range m.byID {
		if x.Email == u.Email {
			return domain.ErrEmailExists
		}
	}
	u.ID = "u" + strconv.Itoa(len(m.byID)+1)
	m.byID[u.ID] = u
	return nil
}
func (m *memUsers) GetByID(_ context.Context, id string) (*domain.User, error) {
	if u, ok := m.byID[id]; ok {
		return u, nil
	}
	return nil, domain.ErrUserNotFound
}
func (m *memUsers) GetByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range m.byID {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, domain.ErrUserNotFound
}
func (m *memUsers) ListByIDs(context.Context, []string) ([]domain.User, error)  { return nil, nil }
func (m *memUsers) UpdateProfile(context.Context, string, string, string) error { return nil }
func (m *memUsers) UpdateLastLogin(context.Context, string, time.Time) error    { return nil }
func (m *memUsers) UpdateStatus(_ context.Context, id, emoji, text string, until *time.Time) error {
	u := m.byID[id]
	u.StatusEmoji, u.StatusText, u.StatusUntil = emoji, text, until
	return nil
}
func (m *memUsers) UpdatePassword(_ context.Context, id, hash string) error {
	m.byID[id].PasswordHash = hash
	return nil
}

type memTokens struct{ list []*domain.RefreshToken }

func (m *memTokens) Create(_ context.Context, t *domain.RefreshToken) error {
	t.ID = "t" + strconv.Itoa(len(m.list)+1)
	m.list = append(m.list, t)
	return nil
}
func (m *memTokens) GetByHash(_ context.Context, h string) (*domain.RefreshToken, error) {
	for _, t := range m.list {
		if t.TokenHash == h {
			c := *t
			return &c, nil
		}
	}
	return nil, domain.ErrTokenNotFound
}
func (m *memTokens) Revoke(_ context.Context, id string) error {
	for _, t := range m.list {
		if t.ID == id {
			t.Revoked = true
		}
	}
	return nil
}
func (m *memTokens) RevokeSession(_ context.Context, sid string) error {
	for _, t := range m.list {
		if t.SessionID == sid {
			t.Revoked = true
		}
	}
	return nil
}
func (m *memTokens) RevokeAllForUser(_ context.Context, uid string) error {
	for _, t := range m.list {
		if t.UserID == uid {
			t.Revoked = true
		}
	}
	return nil
}

type memResets struct{}

func (memResets) Create(context.Context, *domain.PasswordResetToken) error { return nil }
func (memResets) GetByHash(context.Context, string) (*domain.PasswordResetToken, error) {
	return nil, domain.ErrTokenNotFound
}
func (memResets) MarkUsed(context.Context, string, time.Time) error { return nil }

type plainHasher struct{}

func (plainHasher) Hash(p string) (string, error) { return "h:" + p, nil }
func (plainHasher) Compare(h, p string) error {
	if h != "h:"+p {
		return errors.New("mismatch")
	}
	return nil
}

type fakeSigner struct{}

func (fakeSigner) GenerateToken(c map[string]any) (string, error) {
	return "jwt-" + c["sub"].(string), nil
}

type noEmail struct{}

func (noEmail) SendPasswordReset(context.Context, string, string) error { return nil }
func (noEmail) SendWorkspaceInvite(context.Context, string, string, string, string) error {
	return nil
}

type sentInvite struct{ to, inviter, workspace, token string }

type inviteRecorder struct{ sent []sentInvite }

func (*inviteRecorder) SendPasswordReset(context.Context, string, string) error { return nil }
func (r *inviteRecorder) SendWorkspaceInvite(_ context.Context, to, inviter, workspace, token string) error {
	r.sent = append(r.sent, sentInvite{to, inviter, workspace, token})
	return nil
}

func newAuth() (*AuthService, *memTokens) {
	toks := &memTokens{}
	return NewAuthService(&memUsers{byID: map[string]*domain.User{}}, toks, memResets{}, plainHasher{}, fakeSigner{}, noEmail{},
		AuthConfig{AccessTTL: time.Minute, RefreshTTL: time.Hour, ResetTTL: time.Hour}), toks
}

func TestRegisterAndLogin(t *testing.T) {
	ctx := context.Background()
	a, _ := newAuth()
	u, pair, err := a.Register(ctx, "  Ann@Example.com ", "Ann Lee", "correct-horse")
	if err != nil {
		t.Fatal(err)
	}
	if u.Email != "ann@example.com" || pair.AccessToken != "jwt-"+u.ID {
		t.Fatalf("unexpected user/pair: %+v %+v", u, pair)
	}
	if _, _, err := a.Register(ctx, "ann@example.com", "Ann", "correct-horse"); !errors.Is(err, domain.ErrEmailExists) {
		t.Fatalf("duplicate email: got %v", err)
	}
	if _, _, err := a.Login(ctx, "ann@example.com", "wrong-password"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("wrong password: got %v", err)
	}
	if _, _, err := a.Login(ctx, "nobody@example.com", "whatever1"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("unknown email must look like a wrong password, got %v", err)
	}
	if _, _, err := a.Register(ctx, "b@example.com", "B", "short"); err == nil {
		t.Fatal("weak password accepted")
	}
}

func TestRefreshRotationDetectsReuse(t *testing.T) {
	ctx := context.Background()
	a, toks := newAuth()
	_, first, err := a.Register(ctx, "ann@example.com", "Ann", "correct-horse")
	if err != nil {
		t.Fatal(err)
	}
	second, err := a.Refresh(ctx, first.RefreshToken)
	if err != nil {
		t.Fatal(err)
	}
	if second.RefreshToken == first.RefreshToken {
		t.Fatal("refresh token was not rotated")
	}
	// Replaying the first token is treated as theft: it fails and kills the session.
	if _, err := a.Refresh(ctx, first.RefreshToken); !errors.Is(err, domain.ErrTokenReused) {
		t.Fatalf("reuse: got %v", err)
	}
	if _, err := a.Refresh(ctx, second.RefreshToken); !errors.Is(err, domain.ErrTokenReused) {
		t.Fatalf("session should be revoked after reuse, got %v", err)
	}
	for _, tk := range toks.list {
		if !tk.Revoked {
			t.Fatalf("token %s still active", tk.ID)
		}
	}
}

func TestRefreshExpired(t *testing.T) {
	ctx := context.Background()
	a, _ := newAuth()
	_, pair, _ := a.Register(ctx, "ann@example.com", "Ann", "correct-horse")
	a.now = func() time.Time { return time.Now().Add(2 * time.Hour) }
	if _, err := a.Refresh(ctx, pair.RefreshToken); !errors.Is(err, domain.ErrTokenExpired) {
		t.Fatalf("got %v", err)
	}
}

func TestChangePasswordRevokesSessions(t *testing.T) {
	ctx := context.Background()
	a, _ := newAuth()
	u, pair, _ := a.Register(ctx, "ann@example.com", "Ann", "correct-horse")
	if _, err := a.ChangePassword(ctx, u.ID, "nope-nope", "battery-staple"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("got %v", err)
	}
	if _, err := a.ChangePassword(ctx, u.ID, "correct-horse", "battery-staple"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Refresh(ctx, pair.RefreshToken); err == nil {
		t.Fatal("old session survived a password change")
	}
	if _, _, err := a.Login(ctx, "ann@example.com", "battery-staple"); err != nil {
		t.Fatal(err)
	}
}

func TestSendInviteOnlyGivesNewPeopleAPasswordLink(t *testing.T) {
	ctx := context.Background()
	users := &memUsers{byID: map[string]*domain.User{}}
	rec := &inviteRecorder{}
	a := NewAuthService(users, &memTokens{}, memResets{}, plainHasher{}, fakeSigner{}, rec, AuthConfig{AccessTTL: time.Minute, RefreshTTL: time.Hour, ResetTTL: time.Hour})
	if _, _, err := a.Register(ctx, "ann@example.com", "Ann", "correct-horse"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := NewUserService(users).FindOrInvite(ctx, "bo@example.com", "Bo"); err != nil {
		t.Fatal(err)
	}
	for _, e := range []string{"ann@example.com", "bo@example.com"} {
		if err := a.SendInvite(ctx, e, "Cy", "Acme"); err != nil {
			t.Fatal(err)
		}
	}
	if len(rec.sent) != 2 || rec.sent[0].token != "" || rec.sent[1].token == "" {
		t.Fatalf("existing users get a log-in link, new ones a password link: %+v", rec.sent)
	}
	if rec.sent[1].inviter != "Cy" || rec.sent[1].workspace != "Acme" {
		t.Fatalf("unexpected invite: %+v", rec.sent[1])
	}
}
