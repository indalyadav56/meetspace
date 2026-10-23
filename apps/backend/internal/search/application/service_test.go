package application

import (
	"context"
	"encoding/json"
	"testing"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
)

type memIndex struct {
	docs map[string]domain.Document
}

func (m *memIndex) Upsert(_ context.Context, docs ...domain.Document) error {
	for _, d := range docs {
		m.docs[d.ID()] = d
	}
	return nil
}
func (m *memIndex) Delete(_ context.Context, ids ...string) error {
	for _, id := range ids {
		delete(m.docs, id)
	}
	return nil
}
func (m *memIndex) DeleteWorkspace(_ context.Context, ws string) error {
	for id, d := range m.docs {
		if d.WorkspaceID == ws {
			delete(m.docs, id)
		}
	}
	return nil
}
func (m *memIndex) Search(context.Context, domain.Query) (*domain.Results, error) { return nil, nil }
func (m *memIndex) Ready(context.Context) error                                   { return nil }

func event(collection, op string, payload any, audience ...string) []byte {
	b, _ := json.Marshal(map[string]any{"workspaceId": "w1", "collection": collection, "op": op, "payload": payload, "audience": audience})
	return b
}

func TestApplyEventIndexesAndDeletes(t *testing.T) {
	ix := &memIndex{docs: map[string]domain.Document{}}
	s := NewService(ix, zap.NewNop())
	ctx := context.Background()

	s.ApplyEvent(ctx, event("tasks", "upsert", map[string]any{"id": "t1", "key": 12, "title": "Ship search", "description": "<p>Use <b>OpenSearch</b></p>", "listId": "l1", "tags": []string{"backend"}, "updatedAt": "2026-10-23T10:00:00Z"}))
	d, ok := ix.docs["task:t1"]
	if !ok || d.Key != "MS-12" || d.Body != "Use OpenSearch #backend" || !d.Public || d.Parent != "l1" {
		t.Fatalf("task doc = %+v", d)
	}

	s.ApplyEvent(ctx, event("messages", "upsert", map[string]any{"id": "m1", "channelId": "dm1", "text": "secret plan", "createdAt": "2026-10-23T10:00:00Z"}, "u1", "u2"))
	if m := ix.docs["message:m1"]; m.Public || len(m.Audience) != 2 {
		t.Fatalf("a DM must stay private to its members: %+v", m)
	}

	s.ApplyEvent(ctx, event("channels", "upsert", map[string]any{"id": "dm1", "kind": "dm", "name": ""}))
	if _, ok := ix.docs["channel:dm1"]; ok {
		t.Fatal("DM channels are not indexed")
	}
	s.ApplyEvent(ctx, event("activity", "upsert", map[string]any{"id": "a1", "text": "x"}))
	if _, ok := ix.docs["activity:a1"]; ok {
		t.Fatal("activity is not searchable")
	}

	s.ApplyEvent(ctx, event("tasks", "delete", map[string]any{"id": "t1"}))
	if _, ok := ix.docs["task:t1"]; ok {
		t.Fatal("deleted task still indexed")
	}
	s.ApplyEvent(ctx, event("workspaces", "delete", map[string]any{"id": "w1"}))
	if len(ix.docs) != 0 {
		t.Fatalf("workspace delete left %d docs", len(ix.docs))
	}
}

func TestReindexReplacesWorkspace(t *testing.T) {
	ix := &memIndex{docs: map[string]domain.Document{"doc:old": {WorkspaceID: "w1", Type: "doc", EntityID: "old"}}}
	s := NewService(ix, zap.NewNop())
	payload, _ := json.Marshal(map[string]any{"id": "d1", "title": "Handbook", "content": "<h1>Hi</h1>"})
	n, err := s.Reindex(context.Background(), "w1", []Change{{Collection: "docs", Op: "upsert", Payload: payload}})
	if err != nil || n != 1 {
		t.Fatalf("n=%d err=%v", n, err)
	}
	if _, ok := ix.docs["doc:old"]; ok {
		t.Fatal("stale document survived a reindex")
	}
	if ix.docs["doc:d1"].Title != "Handbook" {
		t.Fatalf("docs = %+v", ix.docs)
	}
}
