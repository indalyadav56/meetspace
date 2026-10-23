// Package filesystem stores clip media on local disk. Swap for an object-store
// adapter (S3, GCS, MinIO) behind the same domain.Storage port in production.
package filesystem

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/media/domain"
)

type Storage struct{ root string }

func New(root string) (*Storage, error) {
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, fmt.Errorf("create media dir: %w", err)
	}
	return &Storage{root: root}, nil
}

// path confines keys to the root directory.
func (s *Storage) path(key string) (string, error) {
	clean := filepath.Clean("/" + key)
	if strings.Contains(clean, "..") {
		return "", errors.New("invalid key")
	}
	return filepath.Join(s.root, clean), nil
}

func (s *Storage) Save(_ context.Context, key string, r io.Reader, max int64) (int64, error) {
	p, err := s.path(key)
	if err != nil {
		return 0, err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		return 0, err
	}
	tmp := p + ".part"
	f, err := os.Create(tmp)
	if err != nil {
		return 0, err
	}
	// Read one byte past the limit so oversize uploads are detected, not truncated.
	n, err := io.Copy(f, io.LimitReader(r, max+1))
	cerr := f.Close()
	if err == nil {
		err = cerr
	}
	if err == nil && n > max {
		err = domain.ErrTooLarge
	}
	if err != nil {
		_ = os.Remove(tmp)
		return 0, err
	}
	return n, os.Rename(tmp, p)
}

func (s *Storage) Open(_ context.Context, key string) (domain.ReadSeekCloser, time.Time, error) {
	p, err := s.path(key)
	if err != nil {
		return nil, time.Time{}, err
	}
	f, err := os.Open(p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, time.Time{}, domain.ErrNotFound
	}
	if err != nil {
		return nil, time.Time{}, err
	}
	st, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return nil, time.Time{}, err
	}
	return f, st.ModTime(), nil
}

func (s *Storage) Delete(_ context.Context, key string) error {
	p, err := s.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
