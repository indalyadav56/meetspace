// Package redis implements the realtime Bus with Redis pub/sub so events reach
// clients connected to any server instance.
package redis

import (
	"context"
	"strings"

	goredis "github.com/redis/go-redis/v9"
)

const prefix = "meetspace:ws:"

type Bus struct{ client *goredis.Client }

func NewBus(client *goredis.Client) *Bus { return &Bus{client: client} }

func (b *Bus) Publish(ctx context.Context, workspaceID string, data []byte) error {
	return b.client.Publish(ctx, prefix+workspaceID, data).Err()
}

func (b *Bus) Subscribe(ctx context.Context, fn func(workspaceID string, data []byte)) error {
	sub := b.client.PSubscribe(ctx, prefix+"*")
	defer sub.Close()
	ch := sub.Channel()
	for {
		select {
		case <-ctx.Done():
			return nil
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			fn(strings.TrimPrefix(msg.Channel, prefix), []byte(msg.Payload))
		}
	}
}
