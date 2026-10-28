// Package ws relays live co-editing of Docs over WebSockets (Yjs updates).
package ws

import (
	"context"
	"encoding/binary"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/docs/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

/*
 * Binary frames, first byte is the type:
 *   0 update     client→server [0][yjs update]
 *                server→client [0][seq:8][yjs update]
 *   1 awareness  relayed as-is (cursors, who's here); never stored
 *   3 synced     server→client [3][flags:1][stored:4] after history; flags&1 = you load the doc's HTML
 *   4 compact    client→server [4][upTo:8][snapshot of every update ≤ upTo]
 *   5 ack        server→client [5][seq:8] for the sender's own update
 */
const (
	msgUpdate    = 0
	msgAwareness = 1
	msgSynced    = 3
	msgCompact   = 4
	msgAck       = 5
	maxFrame     = 16 << 20 // docs may embed images
)

// Access says whether a person may open a doc, and whether they may edit it.
type Access func(ctx context.Context, ws, user, docID string) (canWrite bool, err error)

type peer struct {
	user     string
	canWrite bool
	send     chan []byte
}

type room struct {
	peers map[*peer]bool
	// initializer is the one client asked to load the doc's existing HTML into
	// an empty collaborative doc, so two people opening it don't both do it.
	initializer *peer
}

type Collab struct {
	repo    domain.CollabRepository
	access  Access
	origins []string
	log     *zap.Logger

	mu    sync.Mutex
	rooms map[string]*room
}

func NewCollab(repo domain.CollabRepository, access Access, allowedOrigins []string, log *zap.Logger) *Collab {
	origins := make([]string, 0, len(allowedOrigins))
	for _, o := range allowedOrigins {
		origins = append(origins, strings.TrimPrefix(strings.TrimPrefix(o, "https://"), "http://"))
	}
	return &Collab{repo: repo, access: access, origins: origins, log: log, rooms: map[string]*room{}}
}

func (c *Collab) join(docID string, p *peer) *room {
	c.mu.Lock()
	defer c.mu.Unlock()
	r := c.rooms[docID]
	if r == nil {
		r = &room{peers: map[*peer]bool{}}
		c.rooms[docID] = r
	}
	r.peers[p] = true
	return r
}

func (c *Collab) leave(docID string, p *peer) {
	c.mu.Lock()
	defer c.mu.Unlock()
	r := c.rooms[docID]
	if r == nil {
		return
	}
	delete(r.peers, p)
	if r.initializer == p {
		r.initializer = nil
	}
	if len(r.peers) == 0 {
		delete(c.rooms, docID)
	}
}

// broadcast sends to everyone in the room except from.
func (c *Collab) broadcast(docID string, from *peer, msg []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	r := c.rooms[docID]
	if r == nil {
		return
	}
	for p := range r.peers {
		if p == from {
			continue
		}
		select {
		case p.send <- msg:
		default: // a peer that can't keep up reconnects and resyncs
		}
	}
}

func frame(kind byte, seq int64, data []byte) []byte {
	out := make([]byte, 9+len(data))
	out[0] = kind
	binary.BigEndian.PutUint64(out[1:9], uint64(seq))
	copy(out[9:], data)
	return out
}

// Connect: GET /workspaces/:wid/docs/:id/collab?access_token=…
func (c *Collab) Connect(gc *gin.Context) {
	ws, user, docID := authctx.WorkspaceID(gc), authctx.UserID(gc), gc.Param("id")
	canWrite, err := c.access(gc.Request.Context(), ws, user, docID)
	if err != nil {
		response.FromError(gc, err)
		return
	}
	conn, err := websocket.Accept(gc.Writer, gc.Request, &websocket.AcceptOptions{OriginPatterns: c.origins})
	if err != nil {
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(maxFrame)
	ctx, cancel := context.WithCancel(gc.Request.Context())
	defer cancel()

	p := &peer{user: user, canWrite: canWrite, send: make(chan []byte, 512)}
	r := c.join(docID, p)
	defer c.leave(docID, p)

	// Writer: everything for this client goes through one goroutine.
	go func() {
		ping := time.NewTicker(25 * time.Second)
		defer ping.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-p.send:
				wctx, wc := context.WithTimeout(ctx, 15*time.Second)
				err := conn.Write(wctx, websocket.MessageBinary, msg)
				wc()
				if err != nil {
					cancel()
					return
				}
			case <-ping.C:
				pctx, pc := context.WithTimeout(ctx, 10*time.Second)
				err := conn.Ping(pctx)
				pc()
				if err != nil {
					cancel()
					return
				}
			}
		}
	}()

	// History first, then "synced".
	updates, err := c.repo.Updates(ctx, docID)
	if err != nil {
		c.log.Warn("collab history", zap.Error(err))
		return
	}
	for _, u := range updates {
		p.send <- frame(msgUpdate, u.Seq, u.Data)
	}
	c.mu.Lock()
	init := len(updates) == 0 && r.initializer == nil && canWrite
	if init {
		r.initializer = p
	}
	c.mu.Unlock()
	synced := []byte{msgSynced, 0, 0, 0, 0, 0}
	if init {
		synced[1] = 1
	}
	binary.BigEndian.PutUint32(synced[2:], uint32(len(updates)))
	p.send <- synced

	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if len(data) == 0 {
			continue
		}
		switch data[0] {
		case msgUpdate:
			if !p.canWrite || len(data) < 2 {
				continue
			}
			seq, err := c.repo.AppendUpdate(ctx, docID, data[1:])
			if err != nil {
				c.log.Warn("collab store", zap.Error(err))
				return
			}
			c.mu.Lock()
			if r.initializer == p {
				r.initializer = nil // the doc now has content
			}
			c.mu.Unlock()
			c.broadcast(docID, p, frame(msgUpdate, seq, data[1:]))
			p.send <- frame(msgAck, seq, nil)
		case msgAwareness:
			c.broadcast(docID, p, data)
		case msgCompact:
			if !p.canWrite || len(data) < 10 {
				continue
			}
			// Only a client alone in the doc is sure it holds every update up to
			// upTo (sequence numbers are global, so gaps can't be detected).
			c.mu.Lock()
			alone := len(r.peers) == 1
			c.mu.Unlock()
			if !alone {
				continue
			}
			upTo := int64(binary.BigEndian.Uint64(data[1:9]))
			if err := c.repo.Compact(ctx, docID, upTo, data[9:]); err != nil {
				c.log.Warn("collab compact", zap.Error(err))
			}
		}
	}
}

// Register mounts the socket on /workspaces/:wid.
func (c *Collab) Register(rg *gin.RouterGroup) {
	rg.GET("/docs/:id/collab", c.Connect)
}

