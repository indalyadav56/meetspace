// Package totp implements time-based one-time passwords (RFC 6238) as used by
// authenticator apps: HMAC-SHA1, 30-second steps, 6 digits.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	Step   = 30 * time.Second
	Digits = 6
)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewSecret returns a random 160-bit secret, base32-encoded for authenticator apps.
func NewSecret() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return b32.EncodeToString(b), nil
}

// Code computes the code for secret at time t.
func Code(secret string, t time.Time) (string, error) {
	key, err := b32.DecodeString(strings.ToUpper(strings.TrimRight(strings.ReplaceAll(secret, " ", ""), "=")))
	if err != nil {
		return "", fmt.Errorf("totp: bad secret: %w", err)
	}
	return hotp(key, uint64(t.Unix())/uint64(Step.Seconds())), nil
}

func hotp(key []byte, counter uint64) string {
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], counter)
	m := hmac.New(sha1.New, key)
	m.Write(msg[:])
	sum := m.Sum(nil)
	off := sum[len(sum)-1] & 0x0f
	v := binary.BigEndian.Uint32(sum[off:off+4]) & 0x7fffffff
	return fmt.Sprintf("%0*d", Digits, v%1_000_000)
}

// Verify checks code against secret, allowing one step of clock drift either way.
func Verify(secret, code string, t time.Time) bool {
	code = strings.ReplaceAll(strings.TrimSpace(code), " ", "")
	if len(code) != Digits {
		return false
	}
	ok := false
	for _, d := range []time.Duration{-Step, 0, Step} {
		want, err := Code(secret, t.Add(d))
		if err != nil {
			return false
		}
		// Check every window so timing doesn't reveal which one matched.
		if subtle.ConstantTimeCompare([]byte(want), []byte(code)) == 1 {
			ok = true
		}
	}
	return ok
}

// URL is the otpauth:// link authenticator apps scan as a QR code.
func URL(issuer, account, secret string) string {
	label := url.PathEscape(issuer + ":" + account)
	q := url.Values{"secret": {secret}, "issuer": {issuer}, "algorithm": {"SHA1"}, "digits": {fmt.Sprint(Digits)}, "period": {"30"}}
	return "otpauth://totp/" + label + "?" + q.Encode()
}
