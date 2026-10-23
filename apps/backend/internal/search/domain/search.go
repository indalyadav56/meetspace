// Package domain defines the search context: what gets indexed and how it is queried.
package domain

import (
	"context"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// Document is one searchable item (a task, doc, message, ...).
type Document struct {
	WorkspaceID string `json:"workspace_id"`
	// Type is the kind of item: task, doc, message, comment, clip, goal, whiteboard,
	// form, list, folder, project, meeting or channel.
	Type     string `json:"type"`
	EntityID string `json:"entity_id"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	// Parent locates the item: the List of a task, the channel of a message,
	// the task of a comment, the project of a doc or List.
	Parent string `json:"parent,omitempty"`
	// Key is a human reference such as "MS-12".
	Key string `json:"key,omitempty"`
	// Audience limits who may see it (DMs); empty means everyone in the workspace.
	Audience  []string  `json:"audience"`
	Public    bool      `json:"public"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ID is the document's id in the index.
func (d Document) ID() string { return d.Type + ":" + d.EntityID }

type Hit struct {
	Document
	Score float64 `json:"score"`
	// Snippet is a highlighted fragment of the matching text (<mark>…</mark>).
	Snippet string `json:"snippet,omitempty"`
}

type Query struct {
	WorkspaceID string
	UserID      string
	Text        string
	Types       []string
	// Sort is "relevance" (default) or "recent".
	Sort  string
	Limit int
}

type Results struct {
	Total int   `json:"total"`
	Hits  []Hit `json:"hits"`
	// Counts per type for the result tabs.
	Counts map[string]int `json:"counts"`
}

// Index is the search engine (OpenSearch).
type Index interface {
	Upsert(ctx context.Context, docs ...Document) error
	Delete(ctx context.Context, ids ...string) error
	DeleteWorkspace(ctx context.Context, workspaceID string) error
	Search(ctx context.Context, q Query) (*Results, error)
	Ready(ctx context.Context) error
}

var (
	ErrUnavailable = apperror.Unavailable("search_unavailable", "search is not configured on this server")
	ErrEmptyQuery  = apperror.Invalid("empty_query", "type something to search for")
)
