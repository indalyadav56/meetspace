// Package application implements clip use cases.
package application

import (
	"context"
	"io"
	"strings"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/media/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

// TaskClips links clips to tasks in the work context.
type TaskClips interface {
	AttachClip(ctx context.Context, workspaceID, taskID, clipID string) error
}

// ChatShare posts a clip into a chat channel.
type ChatShare interface {
	PostClipMessage(ctx context.Context, workspaceID, actorID, channelID, text, clipID string) error
}

type Service struct {
	repo    domain.Repository
	store   domain.Storage
	pub     Publisher
	tasks   TaskClips
	chat    ChatShare
	maxSize int64
}

func NewService(repo domain.Repository, store domain.Storage, pub Publisher, tasks TaskClips, chat ChatShare, maxSize int64) *Service {
	return &Service{repo: repo, store: store, pub: pub, tasks: tasks, chat: chat, maxSize: maxSize}
}

var kinds = map[string]bool{"screen": true, "camera": true, "screen+camera": true, "call": true, "audio": true}

type UploadInput struct {
	Title       string
	Kind        string
	Mime        string
	DurationSec int
	TaskID      *string
	Transcript  string
	Thumb       string
}

func (s *Service) Upload(ctx context.Context, ws, actorID string, in UploadInput, body io.Reader) (*domain.Clip, error) {
	// Browsers report e.g. "video/webm;codecs=vp9,opus"; the unquoted comma makes
	// mime.ParseMediaType reject it, so only the type/subtype is checked.
	mt := strings.ToLower(strings.TrimSpace(strings.SplitN(in.Mime, ";", 2)[0]))
	if !(strings.HasPrefix(mt, "video/") || strings.HasPrefix(mt, "audio/")) {
		return nil, domain.ErrInvalidMedia
	}
	if !kinds[in.Kind] {
		return nil, apperror.Invalid("invalid_kind", "unknown clip kind")
	}
	// Thumbnails are small data: URLs generated in the browser; refuse anything else.
	if in.Thumb != "" && (!strings.HasPrefix(in.Thumb, "data:image/") || len(in.Thumb) > 200_000) {
		in.Thumb = ""
	}
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = "Untitled clip"
	}
	if len(title) > 200 {
		title = title[:200]
	}
	ext := ".webm"
	if strings.Contains(mt, "mp4") {
		ext = ".mp4"
	}
	key := ws + "/" + uuid.NewString() + ext
	size, err := s.store.Save(ctx, key, body, s.maxSize)
	if err != nil {
		return nil, err
	}
	c := &domain.Clip{WorkspaceID: ws, Title: title, Kind: in.Kind, CreatedBy: actorID, DurationSec: in.DurationSec, Size: size, Mime: in.Mime, Transcript: in.Transcript, Thumb: in.Thumb, StorageKey: key}
	if err := s.repo.Create(ctx, c); err != nil {
		_ = s.store.Delete(ctx, key)
		return nil, err
	}
	s.pub.Publish(ctx, ws, "clips", "upsert", c, nil)
	if in.TaskID != nil && *in.TaskID != "" {
		if _, err := s.AttachToTask(ctx, ws, c.ID, *in.TaskID); err != nil {
			return nil, err
		}
	}
	return c, nil
}

func (s *Service) Open(ctx context.Context, ws, id string) (*domain.Clip, domain.ReadSeekCloser, error) {
	c, err := s.repo.Get(ctx, ws, id)
	if err != nil {
		return nil, nil, err
	}
	f, _, err := s.store.Open(ctx, c.StorageKey)
	if err != nil {
		return nil, nil, err
	}
	return c, f, nil
}

func (s *Service) Rename(ctx context.Context, ws, id, title string) (*domain.Clip, error) {
	c, err := s.repo.Get(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	t := strings.TrimSpace(title)
	if t == "" || len(t) > 200 {
		return nil, apperror.Invalid("invalid_title", "title must be 1-200 characters")
	}
	c.Title = t
	if err := s.repo.Update(ctx, c); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "clips", "upsert", c, nil)
	return c, nil
}

func (s *Service) AttachToTask(ctx context.Context, ws, id, taskID string) (*domain.Clip, error) {
	c, err := s.repo.Get(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if err := s.tasks.AttachClip(ctx, ws, taskID, id); err != nil {
		return nil, err
	}
	c.TaskID = &taskID
	if err := s.repo.Update(ctx, c); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "clips", "upsert", c, nil)
	return c, nil
}

func (s *Service) Share(ctx context.Context, ws, actorID, id, channelID string) error {
	c, err := s.repo.Get(ctx, ws, id)
	if err != nil {
		return err
	}
	return s.chat.PostClipMessage(ctx, ws, actorID, channelID, "Shared a clip: "+c.Title, id)
}

func (s *Service) Delete(ctx context.Context, ws, actorID, id string) error {
	c, err := s.repo.Get(ctx, ws, id)
	if err != nil {
		return err
	}
	if c.CreatedBy != actorID {
		return apperror.Forbidden("not_owner", "only the person who recorded a clip can delete it")
	}
	if err := s.repo.Delete(ctx, ws, id); err != nil {
		return err
	}
	_ = s.store.Delete(ctx, c.StorageKey)
	s.pub.Publish(ctx, ws, "clips", "delete", map[string]string{"id": id}, nil)
	return nil
}

func (s *Service) Snapshot(ctx context.Context, ws, _ string) (map[string]any, error) {
	cs, err := s.repo.List(ctx, ws)
	if err != nil {
		return nil, err
	}
	if cs == nil {
		cs = []domain.Clip{}
	}
	return map[string]any{"clips": cs}, nil
}
