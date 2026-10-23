// Package domain defines the realtime event envelope.
package domain

import "context"

// Event is a change pushed to clients. Collection names match the client store
// ("tasks", "messages", ...); Op is "upsert", "delete" or a signal name.
type Event struct {
	WorkspaceID string `json:"workspaceId"`
	Collection  string `json:"collection"`
	Op          string `json:"op"`
	Payload     any    `json:"payload"`
	// Audience restricts delivery to these user ids; empty means everyone in the workspace.
	Audience []string `json:"audience,omitempty"`
}

// Bus moves serialized events between server instances.
type Bus interface {
	Publish(ctx context.Context, workspaceID string, data []byte) error
	// Subscribe calls fn for every event published by any instance until ctx ends.
	Subscribe(ctx context.Context, fn func(workspaceID string, data []byte)) error
}
