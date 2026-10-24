package di

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"
	"google.golang.org/adk/session"
	adkdb "google.golang.org/adk/session/database"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	assistantapp "github.com/indalyadav56/meetspace/backend/internal/assistant/application"
	"github.com/indalyadav56/meetspace/backend/internal/assistant/infrastructure/adk"
	assistantpg "github.com/indalyadav56/meetspace/backend/internal/assistant/infrastructure/postgres"
	assistanthttp "github.com/indalyadav56/meetspace/backend/internal/assistant/transport/http/v1"
	chatapp "github.com/indalyadav56/meetspace/backend/internal/chat/application"
	chatpg "github.com/indalyadav56/meetspace/backend/internal/chat/infrastructure/postgres"
	chathttp "github.com/indalyadav56/meetspace/backend/internal/chat/transport/http/v1"
	docsapp "github.com/indalyadav56/meetspace/backend/internal/docs/application"
	docspg "github.com/indalyadav56/meetspace/backend/internal/docs/infrastructure/postgres"
	docshttp "github.com/indalyadav56/meetspace/backend/internal/docs/transport/http/v1"
	goalsapp "github.com/indalyadav56/meetspace/backend/internal/goals/application"
	goalspg "github.com/indalyadav56/meetspace/backend/internal/goals/infrastructure/postgres"
	goalshttp "github.com/indalyadav56/meetspace/backend/internal/goals/transport/http/v1"
	identityapp "github.com/indalyadav56/meetspace/backend/internal/identity/application"
	"github.com/indalyadav56/meetspace/backend/internal/identity/infrastructure/email"
	identitypg "github.com/indalyadav56/meetspace/backend/internal/identity/infrastructure/postgres"
	identityhttp "github.com/indalyadav56/meetspace/backend/internal/identity/transport/http/v1"
	integrationsapp "github.com/indalyadav56/meetspace/backend/internal/integrations/application"
	integrationshttp "github.com/indalyadav56/meetspace/backend/internal/integrations/transport/http/v1"
	mediaapp "github.com/indalyadav56/meetspace/backend/internal/media/application"
	mediadomain "github.com/indalyadav56/meetspace/backend/internal/media/domain"
	"github.com/indalyadav56/meetspace/backend/internal/media/infrastructure/filesystem"
	miniostore "github.com/indalyadav56/meetspace/backend/internal/media/infrastructure/minio"
	mediapg "github.com/indalyadav56/meetspace/backend/internal/media/infrastructure/postgres"
	mediahttp "github.com/indalyadav56/meetspace/backend/internal/media/transport/http/v1"
	meetapp "github.com/indalyadav56/meetspace/backend/internal/meet/application"
	meetdomain "github.com/indalyadav56/meetspace/backend/internal/meet/domain"
	"github.com/indalyadav56/meetspace/backend/internal/meet/infrastructure/livekit"
	meetpg "github.com/indalyadav56/meetspace/backend/internal/meet/infrastructure/postgres"
	meethttp "github.com/indalyadav56/meetspace/backend/internal/meet/transport/http/v1"
	notifyapp "github.com/indalyadav56/meetspace/backend/internal/notify/application"
	notifypg "github.com/indalyadav56/meetspace/backend/internal/notify/infrastructure/postgres"
	notifyhttp "github.com/indalyadav56/meetspace/backend/internal/notify/transport/http/v1"
	realtimeapp "github.com/indalyadav56/meetspace/backend/internal/realtime/application"
	realtimeredis "github.com/indalyadav56/meetspace/backend/internal/realtime/infrastructure/redis"
	realtimews "github.com/indalyadav56/meetspace/backend/internal/realtime/transport/ws"
	searchapp "github.com/indalyadav56/meetspace/backend/internal/search/application"
	searchhttp "github.com/indalyadav56/meetspace/backend/internal/search/transport/http/v1"
	workapp "github.com/indalyadav56/meetspace/backend/internal/work/application"
	workpg "github.com/indalyadav56/meetspace/backend/internal/work/infrastructure/postgres"
	workhttp "github.com/indalyadav56/meetspace/backend/internal/work/transport/http/v1"
	workspaceapp "github.com/indalyadav56/meetspace/backend/internal/workspace/application"
	workspacepg "github.com/indalyadav56/meetspace/backend/internal/workspace/infrastructure/postgres"
	workspacehttp "github.com/indalyadav56/meetspace/backend/internal/workspace/transport/http/v1"
	"github.com/indalyadav56/meetspace/backend/pkg/jwt"
	"github.com/indalyadav56/meetspace/backend/pkg/mailer"
	"github.com/indalyadav56/meetspace/backend/pkg/password"
)

const (
	defaultAccessTTL  = 15 * time.Minute
	defaultRefreshTTL = 30 * 24 * time.Hour
	defaultResetTTL   = time.Hour
	defaultCallTTL    = 6 * time.Hour
)

// Handlers is everything the router mounts.
type Handlers struct {
	Identity     *identityhttp.Handler
	Workspace    *workspacehttp.Handler
	Work         *workhttp.Handler
	Docs         *docshttp.Handler
	Goals        *goalshttp.Handler
	Chat         *chathttp.Handler
	Notify       *notifyhttp.Handler
	Media        *mediahttp.Handler
	Meet         *meethttp.Handler
	Assistant    *assistanthttp.Handler
	Search       *searchhttp.Handler
	Integrations *integrationshttp.Handler
	Realtime     *realtimews.Handler
	Signer       *jwt.JWT
	Workspaces   *workspaceapp.Service
}

// Services exposes the application services, for tools such as the seeder
// that drive the domain without going through HTTP.
type Services struct {
	Auth         *identityapp.AuthService
	Users        *identityapp.UserService
	Workspaces   *workspaceapp.Service
	Work         *workapp.Service
	Docs         *docsapp.Service
	Goals        *goalsapp.Service
	Chat         *chatapp.Service
	Notify       *notifyapp.Service
	Media        *mediaapp.Service
	Meet         *meetapp.Service
	Search       *searchapp.Service
	Integrations *integrationsapp.Service
}

// ServerContainer wires the HTTP API binary.
type ServerContainer struct {
	*Shared
	// Ready checks every backing service the API needs (database, Redis, object storage).
	Ready    func(context.Context) error
	Hub      *realtimeapp.Hub
	Services Services
	Handlers Handlers
}

// bootstraps lets the workspace service run the starter-content hooks of
// contexts that themselves depend on the workspace service.
type bootstraps struct {
	list []workspaceapp.Bootstrapper
}

func (b *bootstraps) Bootstrap(ctx context.Context, ws, owner string) error {
	for _, x := range b.list {
		if err := x.Bootstrap(ctx, ws, owner); err != nil {
			return err
		}
	}
	return nil
}

func NewServerContainer(ctx context.Context, sh *Shared) (*ServerContainer, error) {
	cfg, log, db := sh.Cfg, sh.Log, sh.DB
	if strings.TrimSpace(cfg.JWT.Secret) == "" {
		return nil, errors.New("jwt.secret is required (set APP_JWT_SECRET)")
	}
	accessTTL := orDefault(cfg.JWT.AccessTokenTTL, defaultAccessTTL)
	signer := jwt.New(jwt.JWTConfig{SecretKey: []byte(cfg.JWT.Secret), TokenDuration: accessTTL, Issuer: cfg.JWT.Issuer})

	hub := realtimeapp.NewHub(realtimeredis.NewBus(sh.Redis), log)

	// identity
	sender, err := newEmailSender(sh)
	if err != nil {
		return nil, err
	}
	userRepo := identitypg.NewUserRepository(db)
	authSvc := identityapp.NewAuthService(userRepo, identitypg.NewRefreshTokenRepository(db), identitypg.NewPasswordResetTokenRepository(db),
		password.NewDefaultBcryptHasher(), signer, sender, identityapp.AuthConfig{
			AccessTTL: accessTTL, RefreshTTL: orDefault(cfg.JWT.RefreshTokenTTL, defaultRefreshTTL), ResetTTL: defaultResetTTL,
		})
	userSvc := identityapp.NewUserService(userRepo)
	dir := userDirectory{users: userSvc}

	// workspace + notify
	notifySvc := notifyapp.NewService(notifypg.NewRepository(db), hub)
	boot := &bootstraps{}
	wsSvc := workspaceapp.NewService(workspacepg.NewRepository(db), hub, userSvc, dir, inviteMailer{auth: authSvc, names: dir, log: log}, boot)
	mentions := mentionResolver{workspaces: wsSvc, users: userSvc}
	// Profile and status edits reach everyone who shares a workspace with the person.
	userSvc.OnChange = func(ctx context.Context, p identityapp.Profile) {
		wss, err := wsSvc.ListForUser(ctx, p.ID)
		if err != nil {
			log.Warn("profile broadcast", zap.Error(err))
			return
		}
		for _, w := range wss {
			hub.Publish(ctx, w.ID, "users", "upsert", profileMap(p), nil)
		}
	}

	// work, chat, docs, goals
	workSvc := workapp.NewService(workpg.NewRepository(db), hub, notifySvc, wsSvc, wsSvc, dir, log)
	chatSvc := chatapp.NewService(chatpg.NewRepository(db), hub, notifySvc, wsSvc, mentions, taskFromText{work: workSvc}, log)
	boot.list = []workspaceapp.Bootstrapper{workSvc, chatSvc}
	docsSvc := docsapp.NewService(docspg.NewRepository(db), hub)
	goalsSvc := goalsapp.NewService(goalspg.NewRepository(db), hub)

	// media (MinIO object storage)
	store, storeReady, err := newMediaStorage(ctx, sh)
	if err != nil {
		return nil, fmt.Errorf("media storage: %w", err)
	}
	maxUpload := cfg.Media.MaxUploadMB << 20
	if maxUpload <= 0 {
		maxUpload = 500 << 20
	}
	mediaSvc := mediaapp.NewService(mediapg.NewRepository(db), store, hub, workSvc, chatSvc, maxUpload)

	// meet (self-hosted LiveKit)
	var rooms *livekit.Rooms
	var access meetdomain.RoomAccess
	if cfg.LiveKit.APIKey != "" && cfg.LiveKit.APISecret != "" {
		apiURL := cfg.LiveKit.APIURL
		if apiURL == "" {
			apiURL = strings.Replace(cfg.LiveKit.URL, "ws", "http", 1)
		}
		rooms = livekit.New(cfg.LiveKit.URL, apiURL, cfg.LiveKit.APIKey, cfg.LiveKit.APISecret)
		access = rooms
	} else {
		log.Warn("livekit is not configured; calls are disabled")
	}
	meetSvc := meetapp.NewService(meetpg.NewRepository(db), access, hub, wsSvc, dir, chatSvc, orDefault(cfg.LiveKit.TokenTTL, defaultCallTTL), log)

	// assistant (Google ADK + Gemini)
	var agent assistantapp.Agent
	if cfg.AI.GeminiAPIKey != "" {
		sessions, err := NewAssistantSessions(cfg.Postgres.DSN())
		if err != nil {
			return nil, err
		}
		tools := assistantTools{work: workSvc, docs: docsSvc, workspaces: wsSvc, users: userSvc}
		a, err := adk.New(ctx, cfg.AI.GeminiAPIKey, cfg.AI.Model, tools, sessions)
		if err != nil {
			return nil, fmt.Errorf("assistant: %w", err)
		}
		agent = a
	} else {
		log.Warn("ai.gemini_api_key is empty; the AI assistant is disabled")
	}

	searchSvc := newSearchService(ctx, sh)

	integrationsSvc, err := newIntegrations(sh, workSvc, wsSvc, hub)
	if err != nil {
		return nil, fmt.Errorf("integrations: %w", err)
	}

	snap := snapshot{providers: []SnapshotProvider{wsSvc, workSvc, docsSvc, goalsSvc, chatSvc, notifySvc, mediaSvc, meetSvc}}

	return &ServerContainer{
		Shared: sh,
		Ready: func(ctx context.Context) error {
			if err := sh.Ready(ctx); err != nil {
				return err
			}
			return storeReady(ctx)
		},
		Hub:      hub,
		Services: Services{Auth: authSvc, Users: userSvc, Workspaces: wsSvc, Work: workSvc, Docs: docsSvc, Goals: goalsSvc, Chat: chatSvc, Notify: notifySvc, Media: mediaSvc, Meet: meetSvc, Search: searchSvc, Integrations: integrationsSvc},
		Handlers: Handlers{
			Identity:     identityhttp.NewHandler(authSvc, userSvc),
			Workspace:    workspacehttp.NewHandler(wsSvc, snap),
			Work:         workhttp.NewHandler(workSvc, mentions),
			Docs:         docshttp.NewHandler(docsSvc),
			Goals:        goalshttp.NewHandler(goalsSvc),
			Chat:         chathttp.NewHandler(chatSvc),
			Notify:       notifyhttp.NewHandler(notifySvc),
			Media:        mediahttp.NewHandler(mediaSvc, maxUpload),
			Meet:         meethttp.NewHandler(meetSvc, rooms, log),
			Assistant:    assistanthttp.NewHandler(assistantapp.NewService(agent, assistantpg.NewAgents(db))),
			Search:       searchhttp.NewHandler(searchSvc),
			Integrations: integrationshttp.NewHandler(integrationsSvc),
			Realtime:     realtimews.NewHandler(hub, wsSvc, cfg.Web.AllowedOrigins, log),
			Signer:       signer,
			Workspaces:   wsSvc,
		},
	}, nil
}

// NewAssistantSessions stores ADK conversation sessions in the assistant
// schema. ADK's models hard-code their table names, so the schema is chosen
// with search_path on a small dedicated pool rather than a gorm table prefix.
func NewAssistantSessions(dsn string) (session.Service, error) {
	s, err := adkdb.NewSessionService(gormpg.Open(dsn+" search_path=assistant"), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("assistant sessions: %w", err)
	}
	return s, nil
}

// newMediaStorage returns the clip store: MinIO unless media.storage is
// "filesystem", plus a readiness check for it.
func newMediaStorage(ctx context.Context, sh *Shared) (mediadomain.Storage, func(context.Context) error, error) {
	cfg := sh.Cfg
	if cfg.Media.Storage == "filesystem" {
		fs, err := filesystem.New(cfg.Media.Dir)
		return fs, func(context.Context) error { return nil }, err
	}
	m := cfg.MinIO
	st, err := miniostore.New(ctx, miniostore.Config{Endpoint: m.Endpoint, AccessKey: m.AccessKey, SecretKey: m.SecretKey, Bucket: cmp.Or(m.Bucket, "meetspace-media"), UseSSL: m.UseSSL, Region: m.Region})
	if err != nil {
		return nil, nil, err
	}
	sh.Log.Info("storing media in MinIO", zap.String("endpoint", m.Endpoint), zap.String("bucket", cmp.Or(m.Bucket, "meetspace-media")))
	return st, st.Ready, nil
}

// defaultFrom is Resend's shared test sender; it only delivers to the Resend
// account's own address, so production should set a verified domain.
const defaultFrom = "Meetspace <onboarding@resend.dev>"

// newEmailSender picks the Resend API, then SMTP, and otherwise logs emails so
// local development needs no provider.
func newEmailSender(sh *Shared) (identityapp.EmailSender, error) {
	cfg, web := sh.Cfg, sh.Cfg.Web.URL
	switch {
	case cfg.Resend.APIKey != "":
		m, err := mailer.NewResend(cfg.Resend.APIKey, cmp.Or(cfg.Resend.From, defaultFrom))
		if err != nil {
			return nil, err
		}
		sh.Log.Info("sending email through the Resend API", zap.String("from", cmp.Or(cfg.Resend.From, defaultFrom)))
		return email.NewSender(m, web), nil
	case cfg.SMTP.Host != "" && cfg.SMTP.Password != "":
		c := cfg.SMTP
		m, err := mailer.New(mailer.Config{Host: c.Host, Port: c.Port, Username: c.User, Password: c.Password, From: cmp.Or(c.From, defaultFrom)})
		if err != nil {
			return nil, err
		}
		sh.Log.Info("sending email over SMTP", zap.String("host", c.Host))
		return email.NewSender(m, web), nil
	default:
		sh.Log.Warn("no email provider configured (set APP_RESEND_API_KEY); emails are logged instead of sent")
		return email.NewLogSender(sh.Log, web), nil
	}
}

func orDefault(d, def time.Duration) time.Duration {
	if d > 0 {
		return d
	}
	return def
}
