package application

import (
	"context"
	"errors"
	"testing"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

type fakeRepo struct {
	domain.Repository
	members map[string]domain.Member
	teams   map[string]domain.Team
}

func (f *fakeRepo) Get(context.Context, string) (*domain.Workspace, error) {
	w := &domain.Workspace{ID: "w"}
	for _, m := range f.members {
		w.Members = append(w.Members, m)
	}
	return w, nil
}

func (f *fakeRepo) Role(_ context.Context, _, uid string) (domain.Role, error) {
	m, ok := f.members[uid]
	if !ok {
		return "", domain.ErrNotMember
	}
	return m.Role, nil
}

func (f *fakeRepo) SetMemberProfile(_ context.Context, _, uid, title string, manager *string) error {
	m := f.members[uid]
	m.Title, m.ManagerID = title, manager
	f.members[uid] = m
	return nil
}

func (f *fakeRepo) SaveTeam(_ context.Context, t *domain.Team) error {
	if t.ID == "" {
		t.ID = "t1"
	}
	f.teams[t.ID] = *t
	return nil
}

func (f *fakeRepo) GetTeam(_ context.Context, _, id string) (*domain.Team, error) {
	t, ok := f.teams[id]
	if !ok {
		return nil, domain.ErrTeamNotFound
	}
	return &t, nil
}

type nopPub struct{}

func (nopPub) Publish(context.Context, string, string, string, any, []string) {}

type nopUsers struct{}

func (nopUsers) ProfilesMap(context.Context, []string) ([]map[string]any, error) { return nil, nil }

func newTestService() (*Service, *fakeRepo) {
	r := &fakeRepo{teams: map[string]domain.Team{}, members: map[string]domain.Member{
		"admin": {UserID: "admin", Role: domain.RoleAdmin},
		"a":     {UserID: "a", Role: domain.RoleMember},
		"b":     {UserID: "b", Role: domain.RoleMember},
		"guest": {UserID: "guest", Role: domain.RoleGuest},
	}}
	return NewService(r, nopPub{}, nil, nopUsers{}, nil), r
}

func ptr(s string) *string { return &s }

func TestSetProfileRejectsManagerCycle(t *testing.T) {
	s, _ := newTestService()
	ctx := context.Background()
	if _, err := s.SetProfile(ctx, "w", "admin", "b", nil, ptr("a"), true); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetProfile(ctx, "w", "admin", "a", nil, ptr("b"), true); !errors.Is(err, domain.ErrManagerCycle) {
		t.Fatalf("want cycle error, got %v", err)
	}
	if _, err := s.SetProfile(ctx, "w", "admin", "a", nil, ptr("a"), true); !errors.Is(err, domain.ErrManagerCycle) {
		t.Fatalf("self-manager: want cycle error, got %v", err)
	}
}

func TestSetProfilePermissions(t *testing.T) {
	s, r := newTestService()
	ctx := context.Background()
	if _, err := s.SetProfile(ctx, "w", "a", "a", ptr("Designer"), nil, false); err != nil {
		t.Fatalf("own title: %v", err)
	}
	if r.members["a"].Title != "Designer" {
		t.Fatalf("title not saved: %+v", r.members["a"])
	}
	if _, err := s.SetProfile(ctx, "w", "a", "b", ptr("x"), nil, false); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("someone else's title: want forbidden, got %v", err)
	}
	if _, err := s.SetProfile(ctx, "w", "a", "a", nil, ptr("b"), true); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("own manager: want forbidden, got %v", err)
	}
}

func TestSaveTeamKeepsOnlyMembers(t *testing.T) {
	s, _ := newTestService()
	ctx := context.Background()
	team, err := s.SaveTeam(ctx, "w", "a", TeamInput{Name: " Design ", Members: []string{"a", "stranger", "a"}, LeadID: ptr("b")}, true)
	if err != nil {
		t.Fatal(err)
	}
	if team.Name != "Design" || len(team.Members) != 2 || team.Members[0] != "a" || team.Members[1] != "b" {
		t.Fatalf("unexpected team: %+v", team)
	}
	if _, err := s.SaveTeam(ctx, "w", "guest", TeamInput{Name: "x"}, true); !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("guest: want forbidden, got %v", err)
	}
	if _, err := s.SaveTeam(ctx, "w", "a", TeamInput{Name: "  "}, true); !errors.Is(err, domain.ErrTeamName) {
		t.Fatalf("blank name: want invalid, got %v", err)
	}
}
