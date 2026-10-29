package di

import (
	"context"

	auditapp "github.com/indalyadav56/meetspace/backend/internal/audit/application"
	identityapp "github.com/indalyadav56/meetspace/backend/internal/identity/application"
	privacyapp "github.com/indalyadav56/meetspace/backend/internal/privacy/application"
	workspaceapp "github.com/indalyadav56/meetspace/backend/internal/workspace/application"
)

// privacyAccount adapts identity to the privacy context.
type privacyAccount struct{ auth *identityapp.AuthService }

func (a privacyAccount) AccountData(ctx context.Context, userID string) (any, error) {
	return a.auth.AccountData(ctx, userID)
}
func (a privacyAccount) ConfirmErase(ctx context.Context, userID, password, email string) error {
	return a.auth.ConfirmErase(ctx, userID, password, email)
}
func (a privacyAccount) Erase(ctx context.Context, userID string) error {
	return a.auth.Erase(ctx, userID)
}

// privacyWorkspaces adapts the workspace context: memberships with head counts, leaving and deleting.
type privacyWorkspaces struct{ ws *workspaceapp.Service }

func (a privacyWorkspaces) Memberships(ctx context.Context, userID string) ([]privacyapp.Membership, error) {
	wss, err := a.ws.ListForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]privacyapp.Membership, 0, len(wss))
	for _, w := range wss {
		roles, err := a.ws.Roles(ctx, w.ID)
		if err != nil {
			return nil, err
		}
		m := privacyapp.Membership{ID: w.ID, Name: w.Name, Role: roles[userID], Members: len(roles)}
		for _, r := range roles {
			if r == "owner" {
				m.Owners++
			}
		}
		out = append(out, m)
	}
	return out, nil
}
func (a privacyWorkspaces) Leave(ctx context.Context, workspaceID, userID string) error {
	return a.ws.RemoveMember(ctx, workspaceID, userID, userID)
}
func (a privacyWorkspaces) Delete(ctx context.Context, workspaceID, userID string) error {
	return a.ws.Delete(ctx, workspaceID, userID)
}

// privacyActivity is the person's own security events from the audit log.
type privacyActivity struct{ audit *auditapp.Service }

func (a privacyActivity) Mine(ctx context.Context, userID string) (any, error) {
	return a.audit.Mine(ctx, userID, 200)
}
