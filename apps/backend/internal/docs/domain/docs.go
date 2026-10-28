// Package domain holds docs and whiteboards.
package domain

import (
	"context"
	"encoding/json"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Doc struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	ProjectID   *string   `json:"projectId"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	Emoji       string    `json:"emoji"`
	CreatedBy   string    `json:"createdBy"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Whiteboard struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"-"`
	Title       string          `json:"title"`
	Items       json.RawMessage `json:"items"`
	CreatedBy   string          `json:"createdBy"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

var (
	ErrDocNotFound        = apperror.NotFound("doc_not_found", "doc not found")
	ErrWhiteboardNotFound = apperror.NotFound("whiteboard_not_found", "whiteboard not found")
	ErrTooLarge           = apperror.Invalid("too_large", "content is too large")
)

// Update is one stored Yjs change to a doc.
type Update struct {
	Seq  int64
	Data []byte
}

// CollabRepository stores live co-editing history.
type CollabRepository interface {
	AppendUpdate(ctx context.Context, docID string, data []byte) (int64, error)
	Updates(ctx context.Context, docID string) ([]Update, error)
	Compact(ctx context.Context, docID string, upTo int64, snapshot []byte) error
}

type Repository interface {
	CollabRepository
	CreateDoc(ctx context.Context, d *Doc) error
	GetDoc(ctx context.Context, ws, id string) (*Doc, error)
	ListDocs(ctx context.Context, ws string) ([]Doc, error)
	UpdateDoc(ctx context.Context, d *Doc) error
	DeleteDoc(ctx context.Context, ws, id, actorID string) error

	CreateWhiteboard(ctx context.Context, w *Whiteboard) error
	GetWhiteboard(ctx context.Context, ws, id string) (*Whiteboard, error)
	ListWhiteboards(ctx context.Context, ws string) ([]Whiteboard, error)
	UpdateWhiteboard(ctx context.Context, w *Whiteboard) error
	DeleteWhiteboard(ctx context.Context, ws, id, actorID string) error

	ListTrash(ctx context.Context, ws string) ([]TrashedItem, error)
	Restore(ctx context.Context, ws, kind, id string) error
	Purge(ctx context.Context, ws, kind, id string) error

	DashboardRepository
}

const (
	TrashDoc        = "doc"
	TrashWhiteboard = "whiteboard"
)

// TrashedItem is a deleted doc or whiteboard waiting in the trash.
type TrashedItem struct {
	Kind      string    `json:"kind"`
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Emoji     string    `json:"emoji"`
	DeletedAt time.Time `json:"deletedAt"`
	DeletedBy string    `json:"deletedBy"`
}

// Dashboard is a saved set of report cards, optionally scoped to one Space.
type Dashboard struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	ProjectID   *string   `json:"projectId"`
	Title       string    `json:"title"`
	Cards       []string  `json:"cards"`
	CreatedBy   string    `json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

var ErrDashboardNotFound = apperror.NotFound("dashboard_not_found", "dashboard not found")

type DashboardRepository interface {
	ListDashboards(ctx context.Context, ws string) ([]Dashboard, error)
	GetDashboard(ctx context.Context, ws, id string) (*Dashboard, error)
	SaveDashboard(ctx context.Context, d *Dashboard) error
	DeleteDashboard(ctx context.Context, ws, id string) error
}
