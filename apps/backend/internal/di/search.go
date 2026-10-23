package di

import (
	"cmp"
	"context"
	"encoding/json"

	"go.uber.org/zap"

	chatpg "github.com/indalyadav56/meetspace/backend/internal/chat/infrastructure/postgres"
	searchapp "github.com/indalyadav56/meetspace/backend/internal/search/application"
	searchdomain "github.com/indalyadav56/meetspace/backend/internal/search/domain"
	"github.com/indalyadav56/meetspace/backend/internal/search/infrastructure/opensearch"
)

// newSearchService connects to OpenSearch. Search is optional: when it isn't
// configured or reachable, the app runs with search disabled.
func newSearchService(ctx context.Context, sh *Shared) *searchapp.Service {
	c := sh.Cfg.OpenSearch
	if len(c.URLs) == 0 {
		sh.Log.Warn("opensearch.urls is empty; search is disabled")
		return searchapp.NewService(nil, sh.Log)
	}
	ix, err := opensearch.New(ctx, opensearch.Config{URLs: c.URLs, Username: c.Username, Password: c.Password, Index: cmp.Or(c.Index, "meetspace-search")})
	if err != nil {
		sh.Log.Error("opensearch unavailable; search is disabled", zap.Error(err))
		return searchapp.NewService(nil, sh.Log)
	}
	sh.Log.Info("search backed by OpenSearch", zap.Strings("urls", c.URLs))
	return searchapp.NewService(ix, sh.Log)
}

// WorkspaceItems collects every searchable item of a workspace from the other
// contexts, in the same shape as their realtime events. Used by `reindex`.
func (c *ServerContainer) WorkspaceItems(ctx context.Context, ws string) ([]searchapp.Change, error) {
	var out []searchapp.Change
	add := func(collection string, items any, audience []string) {
		raw, err := json.Marshal(items)
		if err != nil {
			return
		}
		var list []json.RawMessage
		if json.Unmarshal(raw, &list) != nil {
			return
		}
		for _, it := range list {
			out = append(out, searchapp.Change{Collection: collection, Op: "upsert", Payload: it, Audience: audience})
		}
	}
	s := c.Services
	// Work's snapshot is per user (the running timer); its workspace-wide state is what we index.
	st, err := s.Work.State(ctx, ws)
	if err != nil {
		return nil, err
	}
	add("projects", st.Projects, nil)
	add("folders", st.Folders, nil)
	add("lists", st.Lists, nil)
	add("tasks", st.Tasks, nil)
	add("comments", st.Comments, nil)
	add("forms", st.Forms, nil)
	for _, p := range []SnapshotProvider{s.Docs, s.Goals, s.Media, s.Meet} {
		snap, err := p.Snapshot(ctx, ws, "")
		if err != nil {
			return nil, err
		}
		for collection, items := range snap {
			if searchapp.Indexed(collection) {
				add(collection, items, nil)
			}
		}
	}
	// Chat needs every channel, including DMs (searchable only by their members).
	repo := chatpg.NewRepository(c.DB)
	channels, err := repo.ListChannels(ctx, ws)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(channels))
	audience := map[string][]string{}
	for _, ch := range channels {
		ids = append(ids, ch.ID)
		if ch.Kind == "dm" {
			audience[ch.ID] = ch.Members
		}
	}
	add("channels", channels, nil)
	msgs, err := repo.RecentMessages(ctx, ws, ids, 100000)
	if err != nil {
		return nil, err
	}
	for _, m := range msgs {
		add("messages", []any{m}, audience[m.ChannelID])
	}
	return out, nil
}

var _ searchdomain.Index = (*opensearch.Index)(nil)
