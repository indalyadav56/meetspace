// Package minio stores clip media in an S3-compatible bucket (MinIO, or AWS S3
// and others that speak the same API).
package minio

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	mc "github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/indalyadav56/meetspace/backend/internal/media/domain"
)

type Config struct {
	// Endpoint is host:port without a scheme, e.g. "minio:9000".
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
	Region    string
}

type Storage struct {
	client *mc.Client
	bucket string
}

// New connects and creates the bucket when it doesn't exist yet.
func New(ctx context.Context, cfg Config) (*Storage, error) {
	client, err := mc.New(cfg.Endpoint, &mc.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client: %w", err)
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	ok, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("minio bucket %q: %w", cfg.Bucket, err)
	}
	if !ok {
		if err := client.MakeBucket(ctx, cfg.Bucket, mc.MakeBucketOptions{Region: cfg.Region}); err != nil {
			return nil, fmt.Errorf("create minio bucket %q: %w", cfg.Bucket, err)
		}
	}
	return &Storage{client: client, bucket: cfg.Bucket}, nil
}

// Ready reports whether the bucket answers (for readiness checks).
func (s *Storage) Ready(ctx context.Context) error {
	_, err := s.client.BucketExists(ctx, s.bucket)
	return err
}

func (s *Storage) Save(ctx context.Context, key string, r io.Reader, max int64) (int64, error) {
	// Read one byte past the limit so oversize uploads are detected, not truncated.
	counted := &countingReader{r: io.LimitReader(r, max+1)}
	info, err := s.client.PutObject(ctx, s.bucket, key, counted, -1, mc.PutObjectOptions{})
	if err != nil {
		return 0, fmt.Errorf("minio put: %w", err)
	}
	if counted.n > max {
		_ = s.Delete(context.WithoutCancel(ctx), key)
		return 0, domain.ErrTooLarge
	}
	return info.Size, nil
}

// Open returns the object for streaming; it supports Seek, so HTTP range
// requests (video seeking) only fetch the bytes they need.
func (s *Storage) Open(ctx context.Context, key string) (domain.ReadSeekCloser, time.Time, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, key, mc.GetObjectOptions{})
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("minio get: %w", err)
	}
	st, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		if isNotFound(err) {
			return nil, time.Time{}, domain.ErrNotFound
		}
		return nil, time.Time{}, fmt.Errorf("minio stat: %w", err)
	}
	return obj, st.LastModified, nil
}

func (s *Storage) Delete(ctx context.Context, key string) error {
	err := s.client.RemoveObject(ctx, s.bucket, key, mc.RemoveObjectOptions{})
	if err != nil && !isNotFound(err) {
		return fmt.Errorf("minio delete: %w", err)
	}
	return nil
}

func isNotFound(err error) bool {
	var resp mc.ErrorResponse
	if errors.As(err, &resp) {
		return resp.Code == "NoSuchKey" || resp.StatusCode == 404
	}
	return mc.ToErrorResponse(err).Code == "NoSuchKey"
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}
