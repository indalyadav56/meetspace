// Package livekit adapts a self-hosted livekit-server to the meet context.
package livekit

import (
	"context"
	"net/http"
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	"github.com/livekit/protocol/webhook"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

type Rooms struct {
	clientURL string
	key       string
	secret    string
	rooms     *lksdk.RoomServiceClient
	keys      auth.KeyProvider
}

// New builds the adapter. apiURL is the HTTP URL reachable from the backend;
// clientURL is the WebSocket URL browsers use.
func New(clientURL, apiURL, key, secret string) *Rooms {
	return &Rooms{
		clientURL: clientURL,
		key:       key,
		secret:    secret,
		rooms:     lksdk.NewRoomServiceClient(apiURL, key, secret),
		keys:      auth.NewSimpleKeyProvider(key, secret),
	}
}

func boolp(b bool) *bool { return &b }

// Token grants join/publish/subscribe/data rights for exactly one room.
func (r *Rooms) Token(room, identity, name string, ttl time.Duration) (string, error) {
	at := auth.NewAccessToken(r.key, r.secret)
	at.SetIdentity(identity).SetName(name).SetValidFor(ttl).SetVideoGrant(&auth.VideoGrant{
		RoomJoin:       true,
		Room:           room,
		CanPublish:     boolp(true),
		CanSubscribe:   boolp(true),
		CanPublishData: boolp(true),
	})
	return at.ToJWT()
}

func (r *Rooms) ClientURL() string { return r.clientURL }

func (r *Rooms) DeleteRoom(ctx context.Context, room string) error {
	_, err := r.rooms.DeleteRoom(ctx, &livekit.DeleteRoomRequest{Room: room})
	return err
}

// WebhookEvent is the subset of a LiveKit webhook the meet context needs.
type WebhookEvent struct {
	Event    string
	Room     string
	Identity string
}

// Receive verifies the webhook signature (signed with the API secret) and decodes it.
func (r *Rooms) Receive(req *http.Request) (*WebhookEvent, error) {
	ev, err := webhook.ReceiveWebhookEvent(req, r.keys)
	if err != nil {
		return nil, err
	}
	out := &WebhookEvent{Event: ev.GetEvent()}
	if ev.GetRoom() != nil {
		out.Room = ev.GetRoom().GetName()
	}
	if ev.GetParticipant() != nil {
		out.Identity = ev.GetParticipant().GetIdentity()
	}
	return out, nil
}
