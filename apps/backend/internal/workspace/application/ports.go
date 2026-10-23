package application

import "context"

// Publisher pushes a change to every connected client of a workspace
// (or only to the listed user ids when audience is non-empty).
type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

// UserInviter finds a user by email or creates an invited placeholder.
type UserInviter interface {
	FindOrInvite(ctx context.Context, email, name string) (id string, created bool, err error)
}

// UserDirectory resolves user ids to public profiles for member lists.
type UserDirectory interface {
	ProfilesMap(ctx context.Context, ids []string) ([]map[string]any, error)
}

// Bootstrapper creates the starter content of a new workspace (a project, a channel...).
type Bootstrapper interface {
	Bootstrap(ctx context.Context, workspaceID, ownerID string) error
}
