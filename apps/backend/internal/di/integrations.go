package di

import (
	"context"

	integrationsapp "github.com/indalyadav56/meetspace/backend/internal/integrations/application"
	"github.com/indalyadav56/meetspace/backend/internal/integrations/infrastructure/github"
	integrationspg "github.com/indalyadav56/meetspace/backend/internal/integrations/infrastructure/postgres"
	workapp "github.com/indalyadav56/meetspace/backend/internal/work/application"
	workspaceapp "github.com/indalyadav56/meetspace/backend/internal/workspace/application"
	"github.com/indalyadav56/meetspace/backend/pkg/secretbox"
)

// integrationTasks lets the integrations context resolve MS-123 keys and log activity.
type integrationTasks struct{ work *workapp.Service }

func (t integrationTasks) TaskIDByKey(ctx context.Context, ws string, key int64) (string, bool) {
	task, err := t.work.FindTaskByKey(ctx, ws, key)
	if err != nil || task == nil {
		return "", false
	}
	return task.ID, true
}

func (t integrationTasks) TaskExists(ctx context.Context, ws, id string) bool {
	_, err := t.work.GetTask(ctx, ws, id)
	return err == nil
}

func (t integrationTasks) RecordActivity(ctx context.Context, ws, taskID, text string) {
	t.work.RecordExternalActivity(ctx, ws, taskID, text)
}

type integrationAdmins struct{ ws *workspaceapp.Service }

func (a integrationAdmins) CanManage(ctx context.Context, ws, userID string) bool {
	ok, err := a.ws.CanManage(ctx, ws, userID)
	return err == nil && ok
}

// newIntegrations builds the GitHub integration. Tokens are encrypted with
// integrations.encryption_key, or a key derived from the JWT secret when unset.
func newIntegrations(sh *Shared, work *workapp.Service, ws *workspaceapp.Service, pub integrationsapp.Publisher) (*integrationsapp.Service, error) {
	key := sh.Cfg.Integrations.EncryptionKey
	if key == "" {
		sh.Log.Warn("integrations.encryption_key is empty; deriving the token encryption key from the JWT secret")
		key = "meetspace-integrations:" + sh.Cfg.JWT.Secret
	}
	box, err := secretbox.FromPassphrase(key)
	if err != nil {
		return nil, err
	}
	cfg := sh.Cfg
	caps := func() map[string]any {
		emailProvider := ""
		switch {
		case cfg.Resend.APIKey != "":
			emailProvider = "resend"
		case cfg.SMTP.Host != "" && cfg.SMTP.Password != "":
			emailProvider = "smtp"
		}
		return map[string]any{
			"email":    map[string]any{"connected": emailProvider != "", "provider": emailProvider},
			"meetings": map[string]any{"connected": cfg.LiveKit.APIKey != "" && cfg.LiveKit.APISecret != "", "provider": "livekit"},
			"ai":       map[string]any{"connected": cfg.AI.GeminiAPIKey != "", "provider": "gemini", "model": cfg.AI.Model},
		}
	}
	return integrationsapp.NewService(integrationspg.NewRepository(sh.DB), github.New(), box, integrationTasks{work: work}, integrationAdmins{ws: ws}, pub, caps, sh.Log), nil
}
