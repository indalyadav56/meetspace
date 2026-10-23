package application

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/media/domain"
)

type memRepo struct{ clips []*domain.Clip }

func (m *memRepo) Create(_ context.Context, c *domain.Clip) error {
	c.ID = "c1"
	m.clips = append(m.clips, c)
	return nil
}
func (m *memRepo) Get(context.Context, string, string) (*domain.Clip, error) {
	return nil, errors.New("unused")
}
func (m *memRepo) Update(context.Context, *domain.Clip) error          { return nil }
func (m *memRepo) Delete(context.Context, string, string) error        { return nil }
func (m *memRepo) List(context.Context, string) ([]domain.Clip, error) { return nil, nil }

type memStore struct{}

func (memStore) Save(_ context.Context, _ string, r io.Reader, _ int64) (int64, error) {
	b, err := io.ReadAll(r)
	return int64(len(b)), err
}
func (memStore) Open(context.Context, string) (domain.ReadSeekCloser, time.Time, error) {
	return nil, time.Time{}, errors.New("unused")
}
func (memStore) Delete(context.Context, string) error { return nil }

type noPub struct{}

func (noPub) Publish(context.Context, string, string, string, any, []string) {}

func TestUploadAcceptsBrowserMimeTypes(t *testing.T) {
	svc := NewService(&memRepo{}, memStore{}, noPub{}, nil, nil, 1<<20)
	for _, mt := range []string{"video/webm;codecs=vp9,opus", "audio/webm;codecs=opus", "video/mp4"} {
		if _, err := svc.Upload(context.Background(), "ws", "u", UploadInput{Kind: "screen", Mime: mt}, strings.NewReader("data")); err != nil {
			t.Errorf("%s: %v", mt, err)
		}
	}
	if _, err := svc.Upload(context.Background(), "ws", "u", UploadInput{Kind: "screen", Mime: "text/html"}, strings.NewReader("x")); !errors.Is(err, domain.ErrInvalidMedia) {
		t.Errorf("text/html accepted: %v", err)
	}
}
