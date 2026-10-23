// Package ws serves the realtime WebSocket endpoint.
package ws

import (
	"context"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/realtime/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// MemberChecker verifies workspace membership.
type MemberChecker interface {
	IsMember(ctx context.Context, workspaceID, userID string) (bool, error)
}

type Handler struct {
	hub            *application.Hub
	members        MemberChecker
	allowedOrigins []string
	log            *zap.Logger
}

func NewHandler(hub *application.Hub, members MemberChecker, allowedOrigins []string, log *zap.Logger) *Handler {
	return &Handler{hub: hub, members: members, allowedOrigins: allowedOrigins, log: log}
}

// Connect upgrades to a WebSocket subscribed to one workspace (?workspace=<id>).
// Authentication happens before this handler via the access_token query param.
func (h *Handler) Connect(c *gin.Context) {
	userID := authctx.UserID(c)
	wid := c.Query("workspace")
	ok, err := h.members.IsMember(c.Request.Context(), wid, userID)
	if err != nil || !ok {
		response.Error(c, http.StatusForbidden, "not_a_member", "you are not a member of this workspace")
		return
	}
	patterns := make([]string, 0, len(h.allowedOrigins))
	for _, o := range h.allowedOrigins {
		patterns = append(patterns, stripScheme(o))
	}
	conn, err := websocket.Accept(c.Writer, c.Request, &websocket.AcceptOptions{OriginPatterns: patterns})
	if err != nil {
		return
	}
	defer conn.CloseNow()

	client := &application.Client{UserID: userID, Send: make(chan []byte, 256)}
	h.hub.Register(wid, client)
	defer h.hub.Unregister(wid, client)
	h.hub.Publish(c.Request.Context(), wid, "presence", "online", map[string]string{"userId": userID}, nil)
	defer h.hub.Publish(context.Background(), wid, "presence", "offline", map[string]string{"userId": userID}, nil)

	ctx := conn.CloseRead(c.Request.Context()) // we only write; reads just handle control frames
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-client.Send:
			wctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Write(wctx, websocket.MessageText, msg)
			cancel()
			if err != nil {
				return
			}
		case <-ping.C:
			pctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

// Online lists users currently connected to this instance.
func (h *Handler) Online(c *gin.Context) {
	response.Data(c, http.StatusOK, h.hub.Online(authctx.WorkspaceID(c)))
}

func stripScheme(o string) string {
	for _, p := range []string{"https://", "http://"} {
		if len(o) > len(p) && o[:len(p)] == p {
			return o[len(p):]
		}
	}
	return o
}
