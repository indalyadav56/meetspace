package application

import (
	"context"
	"errors"
)

var ErrUnknownTeam = errors.New("unknown team")

// TeamChecker is what chat needs from "somewhere" to validate that a channel's
// team exists. Wired to the workspace context in the composition root.
type TeamChecker interface {
	TeamExists(ctx context.Context, teamID string) error
}
