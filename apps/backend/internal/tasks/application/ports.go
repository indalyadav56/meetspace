package application

import (
	"context"
	"errors"
)

// ErrUnknownTeam is returned through the TeamInfo port when the team does not
// exist. The adapter wired in the composition root translates the provider's
// own not-found error into this one, so tasks never imports workspace.
var ErrUnknownTeam = errors.New("unknown team")

// TeamInfo is what the tasks context needs from "somewhere" to build task
// keys. The workspace context's service satisfies it (via an adapter) in the
// composition root; only the composition root knows both packages.
type TeamInfo interface {
	TeamKey(ctx context.Context, teamID string) (string, error)
}
