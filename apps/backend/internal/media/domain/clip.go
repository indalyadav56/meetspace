// Package domain holds recorded clips (screen, camera, voice and call recordings).
package domain

import (
	"context"
	"io"
	"time"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Clip struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"-"`
	Title       string    `json:"title"`
	Kind        string    `json:"kind"`
	CreatedBy   string    `json:"createdBy"`
	CreatedAt   time.Time `json:"createdAt"`
	DurationSec int       `json:"durationSec"`
	Size        int64     `json:"size"`
	Mime        string    `json:"mime"`
	TaskID      *string   `json:"taskId"`
	Transcript  string    `json:"transcript"`
	Thumb       string    `json:"thumb,omitempty"`
	StorageKey  string    `json:"-"`
}

var (
	ErrNotFound     = apperror.NotFound("clip_not_found", "clip not found")
	ErrInvalidMedia = apperror.Invalid("invalid_media", "only audio and video files can be uploaded")
	ErrTooLarge     = apperror.Invalid("too_large", "file is too large")
)

type Repository interface {
	Create(ctx context.Context, c *Clip) error
	Get(ctx context.Context, ws, id string) (*Clip, error)
	List(ctx context.Context, ws string) ([]Clip, error)
	Update(ctx context.Context, c *Clip) error
	Delete(ctx context.Context, ws, id string) error
}

// ReadSeekCloser is what playback needs for range requests.
type ReadSeekCloser interface {
	io.ReadSeeker
	io.Closer
}

// Storage holds clip bytes.
type Storage interface {
	Save(ctx context.Context, key string, r io.Reader, max int64) (int64, error)
	Open(ctx context.Context, key string) (ReadSeekCloser, time.Time, error)
	Delete(ctx context.Context, key string) error
}
