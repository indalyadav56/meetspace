package application

import (
	"context"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
)

// RecordExternalActivity adds an activity line written by an integration
// (e.g. "linked GitHub pull request #12"); it shows as automation.
func (s *Service) RecordExternalActivity(ctx context.Context, ws, taskID, text string) {
	s.logActivity(ctx, ws, taskID, domain.BotID, text)
}
