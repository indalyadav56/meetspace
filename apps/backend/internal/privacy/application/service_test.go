package application

import (
	"context"
	"errors"
	"testing"
)

type fakeAccount struct{ erased, wrongPassword bool }

func (f *fakeAccount) AccountData(context.Context, string) (any, error) { return "me", nil }
func (f *fakeAccount) ConfirmErase(_ context.Context, _, password, _ string) error {
	if f.wrongPassword {
		return errors.New("bad password")
	}
	return nil
}
func (f *fakeAccount) Erase(context.Context, string) error { f.erased = true; return nil }

type fakeWorkspaces struct {
	ms            []Membership
	left, deleted []string
}

func (f *fakeWorkspaces) Memberships(context.Context, string) ([]Membership, error) { return f.ms, nil }
func (f *fakeWorkspaces) Leave(_ context.Context, ws, _ string) error {
	f.left = append(f.left, ws)
	return nil
}
func (f *fakeWorkspaces) Delete(_ context.Context, ws, _ string) error {
	f.deleted = append(f.deleted, ws)
	return nil
}

type fakeRepo struct{ forgot bool }

func (f *fakeRepo) Content(context.Context, string) (map[string]any, error) {
	return map[string]any{}, nil
}
func (f *fakeRepo) Forget(context.Context, string) error { f.forgot = true; return nil }

type noActivity struct{}

func (noActivity) Mine(context.Context, string) (any, error) { return nil, nil }

func TestDeleteLeavesSharedAndDeletesSolo(t *testing.T) {
	acc, ws, repo := &fakeAccount{}, &fakeWorkspaces{ms: []Membership{
		{ID: "solo", Name: "Mine", Role: "owner", Members: 1, Owners: 1},
		{ID: "team", Name: "Team", Role: "member", Members: 5, Owners: 1},
		{ID: "co", Name: "Co-owned", Role: "owner", Members: 3, Owners: 2},
	}}, &fakeRepo{}
	s := NewService(acc, ws, noActivity{}, repo, Contact{})
	if err := s.Delete(context.Background(), "u1", "pw", ""); err != nil {
		t.Fatal(err)
	}
	if len(ws.deleted) != 1 || ws.deleted[0] != "solo" || len(ws.left) != 2 {
		t.Fatalf("deleted %v left %v", ws.deleted, ws.left)
	}
	if !repo.forgot || !acc.erased {
		t.Fatal("personal data not removed")
	}
}

func TestDeleteBlockedForSoleOwnerOfSharedWorkspace(t *testing.T) {
	acc, ws, repo := &fakeAccount{}, &fakeWorkspaces{ms: []Membership{{ID: "team", Name: "Acme", Role: "owner", Members: 4, Owners: 1}}}, &fakeRepo{}
	err := NewService(acc, ws, noActivity{}, repo, Contact{}).Delete(context.Background(), "u1", "pw", "")
	if err == nil || acc.erased || len(ws.left) > 0 {
		t.Fatalf("expected a sole-owner error and no changes, got %v", err)
	}
}

func TestDeleteNeedsConfirmation(t *testing.T) {
	acc, ws, repo := &fakeAccount{wrongPassword: true}, &fakeWorkspaces{}, &fakeRepo{}
	if err := NewService(acc, ws, noActivity{}, repo, Contact{}).Delete(context.Background(), "u1", "nope", ""); err == nil || acc.erased || repo.forgot {
		t.Fatal("deleted without the right password")
	}
}
