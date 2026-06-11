package di

import (
	"context"
	"errors"
	"log/slog"

	"github.com/indalyadav56/meetspace/backend/internal/config"

	calendarApp "github.com/indalyadav56/meetspace/backend/internal/calendar/application"
	calendarPg "github.com/indalyadav56/meetspace/backend/internal/calendar/infrastructure/postgres"
	calendarV1 "github.com/indalyadav56/meetspace/backend/internal/calendar/transport/http/v1"
	chatApp "github.com/indalyadav56/meetspace/backend/internal/chat/application"
	chatPg "github.com/indalyadav56/meetspace/backend/internal/chat/infrastructure/postgres"
	chatV1 "github.com/indalyadav56/meetspace/backend/internal/chat/transport/http/v1"
	tasksApp "github.com/indalyadav56/meetspace/backend/internal/tasks/application"
	tasksPg "github.com/indalyadav56/meetspace/backend/internal/tasks/infrastructure/postgres"
	tasksV1 "github.com/indalyadav56/meetspace/backend/internal/tasks/transport/http/v1"
	workspaceApp "github.com/indalyadav56/meetspace/backend/internal/workspace/application"
	workspaceDomain "github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
	workspacePg "github.com/indalyadav56/meetspace/backend/internal/workspace/infrastructure/postgres"
	workspaceV1 "github.com/indalyadav56/meetspace/backend/internal/workspace/transport/http/v1"
)

// ServerContainer wires everything the HTTP server binary needs — and only that.
type ServerContainer struct {
	Shared *Shared

	WorkspaceService *workspaceApp.WorkspaceService
	WorkspaceHandler *workspaceV1.Handler

	TaskService *tasksApp.TaskService
	TaskHandler *tasksV1.Handler

	ChatService *chatApp.ChatService
	ChatHandler *chatV1.Handler

	CalendarService *calendarApp.CalendarService
	CalendarHandler *calendarV1.Handler
}

func NewServerContainer(ctx context.Context, cfg *config.Config, log *slog.Logger) (*ServerContainer, error) {
	shared, err := NewShared(ctx, cfg, log)
	if err != nil {
		return nil, err
	}
	c := &ServerContainer{Shared: shared}
	c.initWorkspace()
	c.initTasks()
	c.initChat()
	c.initCalendar()
	return c, nil
}

func (c *ServerContainer) initWorkspace() {
	users := workspacePg.NewUserRepository(c.Shared.DB)
	teams := workspacePg.NewTeamRepository(c.Shared.DB)
	c.WorkspaceService = workspaceApp.NewWorkspaceService(users, teams, c.Shared.Logger)
	c.WorkspaceHandler = workspaceV1.NewHandler(c.WorkspaceService)
}

func (c *ServerContainer) initTasks() {
	repo := tasksPg.NewRepository(c.Shared.DB)
	// Adapter: satisfies tasks' TeamInfo port with the workspace service,
	// translating workspace's not-found error into tasks' own port error.
	teamInfo := teamInfoAdapter{ws: c.WorkspaceService}
	c.TaskService = tasksApp.NewTaskService(repo, teamInfo, c.Shared.Logger)
	c.TaskHandler = tasksV1.NewHandler(c.TaskService)
}

func (c *ServerContainer) initChat() {
	channels := chatPg.NewChannelRepository(c.Shared.DB)
	messages := chatPg.NewMessageRepository(c.Shared.DB)
	teamChecker := teamCheckerAdapter{ws: c.WorkspaceService}
	c.ChatService = chatApp.NewChatService(channels, messages, teamChecker, c.Shared.Logger)
	c.ChatHandler = chatV1.NewHandler(c.ChatService)
}

func (c *ServerContainer) initCalendar() {
	repo := calendarPg.NewRepository(c.Shared.DB)
	c.CalendarService = calendarApp.NewCalendarService(repo, c.Shared.Logger)
	c.CalendarHandler = calendarV1.NewHandler(c.CalendarService)
}

func (c *ServerContainer) Close() error {
	return c.Shared.Close()
}

// teamInfoAdapter bridges workspace → tasks.TeamInfo without either context
// importing the other; only this package knows both error vocabularies.
type teamInfoAdapter struct {
	ws *workspaceApp.WorkspaceService
}

func (a teamInfoAdapter) TeamKey(ctx context.Context, teamID string) (string, error) {
	key, err := a.ws.TeamKey(ctx, teamID)
	if errors.Is(err, workspaceDomain.ErrTeamNotFound) {
		return "", tasksApp.ErrUnknownTeam
	}
	return key, err
}

// teamCheckerAdapter bridges workspace → chat.TeamChecker.
type teamCheckerAdapter struct {
	ws *workspaceApp.WorkspaceService
}

func (a teamCheckerAdapter) TeamExists(ctx context.Context, teamID string) error {
	err := a.ws.TeamExists(ctx, teamID)
	if errors.Is(err, workspaceDomain.ErrTeamNotFound) {
		return chatApp.ErrUnknownTeam
	}
	return err
}
