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

type Repository interface {
	CreateDoc(ctx context.Context, d *Doc) error
	GetDoc(ctx context.Context, ws, id string) (*Doc, error)
	ListDocs(ctx context.Context, ws string) ([]Doc, error)
	UpdateDoc(ctx context.Context, d *Doc) error
	DeleteDoc(ctx context.Context, ws, id string) error

	CreateWhiteboard(ctx context.Context, w *Whiteboard) error
	GetWhiteboard(ctx context.Context, ws, id string) (*Whiteboard, error)
	ListWhiteboards(ctx context.Context, ws string) ([]Whiteboard, error)
	UpdateWhiteboard(ctx context.Context, w *Whiteboard) error
	DeleteWhiteboard(ctx context.Context, ws, id string) error
}
