// Package application fans realtime events out to connected clients.
package application

import (
	"context"
	"encoding/json"
	"sync"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/realtime/domain"
)

// Client is one connected socket.
type Client struct {
	UserID string
	Send   chan []byte
}

type Hub struct {
	bus domain.Bus
	log *zap.Logger

	mu      sync.RWMutex
	clients map[string]map[*Client]struct{} // workspace -> clients
}

func NewHub(bus domain.Bus, log *zap.Logger) *Hub {
	return &Hub{bus: bus, log: log, clients: map[string]map[*Client]struct{}{}}
}

// Publish satisfies every context's Publisher port. Errors are logged, never
// returned: realtime delivery is best-effort and must not fail a write.
func (h *Hub) Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string) {
	data, err := json.Marshal(domain.Event{WorkspaceID: workspaceID, Collection: collection, Op: op, Payload: payload, Audience: audience})
	if err != nil {
		h.log.Warn("realtime marshal failed", zap.Error(err), zap.String("collection", collection))
		return
	}
	if err := h.bus.Publish(context.WithoutCancel(ctx), workspaceID, data); err != nil {
		h.log.Warn("realtime publish failed", zap.Error(err))
	}
}

// Run delivers bus events to local clients until ctx is cancelled.
func (h *Hub) Run(ctx context.Context) error {
	return h.bus.Subscribe(ctx, h.deliver)
}

func (h *Hub) deliver(workspaceID string, data []byte) {
	var head struct {
		Audience []string `json:"audience"`
	}
	_ = json.Unmarshal(data, &head)
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[workspaceID] {
		if len(head.Audience) > 0 && !contains(head.Audience, c.UserID) {
			continue
		}
		select {
		case c.Send <- data:
		default:
			// Slow consumer: drop rather than block the fan-out. The client resyncs on reconnect.
		}
	}
}

func (h *Hub) Register(workspaceID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[workspaceID] == nil {
		h.clients[workspaceID] = map[*Client]struct{}{}
	}
	h.clients[workspaceID][c] = struct{}{}
}

func (h *Hub) Unregister(workspaceID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients[workspaceID], c)
	if len(h.clients[workspaceID]) == 0 {
		delete(h.clients, workspaceID)
	}
}

// Online returns the distinct user ids connected to this instance for a workspace.
func (h *Hub) Online(workspaceID string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	seen := map[string]struct{}{}
	for c := range h.clients[workspaceID] {
		seen[c.UserID] = struct{}{}
	}
	out := make([]string, 0, len(seen))
	for id := range seen {
		out = append(out, id)
	}
	return out
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}
