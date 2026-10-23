package application

import "context"

// Publisher pushes changes to connected clients of a workspace.
type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

// Notifier delivers an inbox notification to one user (never to the actor).
type Notifier interface {
	Notify(ctx context.Context, workspaceID, recipientID, kind, taskID, actorID, text string, important bool) error
}

// Members answers workspace membership questions.
type Members interface {
	IsMember(ctx context.Context, workspaceID, userID string) (bool, error)
	MemberIDs(ctx context.Context, workspaceID string) ([]string, error)
	// CanManage reports whether the user is an owner or admin (e.g. may approve timesheets).
	CanManage(ctx context.Context, workspaceID, userID string) (bool, error)
}

// KeyAllocator reserves human-readable task numbers.
type KeyAllocator interface {
	NextTaskKey(ctx context.Context, workspaceID string) (int64, error)
}

// UserNames resolves display names for activity text.
type UserNames interface {
	DisplayName(ctx context.Context, userID string) string
}
