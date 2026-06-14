// Package ratelimit provides a small in-memory fixed-window rate limiter.
//
// It is process-local: counters are not shared across replicas. That is fine
// for a single instance and for slowing brute-force attempts; swap in a
// Redis-backed limiter behind the same Allow method when scaling horizontally.
package ratelimit

import (
	"sync"
	"time"
)

// Limiter counts hits per key within a fixed time window.
type Limiter struct {
	max    int
	window time.Duration
	now    func() time.Time

	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	count   int
	resetAt time.Time
}

// Option configures a Limiter.
type Option func(*Limiter)

// WithClock overrides the time source, primarily for tests.
func WithClock(now func() time.Time) Option {
	return func(l *Limiter) { l.now = now }
}

// New returns a Limiter allowing at most max hits per key per window.
func New(max int, window time.Duration, opts ...Option) *Limiter {
	l := &Limiter{
		max:     max,
		window:  window,
		now:     time.Now,
		buckets: make(map[string]*bucket),
	}
	for _, opt := range opts {
		opt(l)
	}
	return l
}

// Allow records a hit for key and reports whether it is within the limit.
// The window resets lazily on the first hit after it elapses.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	b, ok := l.buckets[key]
	if !ok || now.After(b.resetAt) {
		l.buckets[key] = &bucket{count: 1, resetAt: now.Add(l.window)}
		l.sweep(now)
		return true
	}
	if b.count >= l.max {
		return false
	}
	b.count++
	return true
}

// sweep drops expired buckets so the map does not grow without bound. The
// caller must hold l.mu.
func (l *Limiter) sweep(now time.Time) {
	for k, b := range l.buckets {
		if now.After(b.resetAt) {
			delete(l.buckets, k)
		}
	}
}
