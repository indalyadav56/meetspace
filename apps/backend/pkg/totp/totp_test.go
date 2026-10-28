package totp

import (
	"encoding/base32"
	"testing"
	"time"
)

// RFC 6238 appendix B vectors for the SHA-1 key "12345678901234567890" (last 6 digits).
func TestRFC6238Vectors(t *testing.T) {
	secret := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte("12345678901234567890"))
	for unix, want := range map[int64]string{59: "287082", 1111111109: "081804", 1111111111: "050471", 1234567890: "005924", 2000000000: "279037"} {
		got, err := Code(secret, time.Unix(unix, 0))
		if err != nil || got != want {
			t.Errorf("Code(%d) = %s, %v; want %s", unix, got, err, want)
		}
	}
}

func TestVerifyDrift(t *testing.T) {
	s, _ := NewSecret()
	now := time.Unix(1_700_000_000, 0)
	prev, _ := Code(s, now.Add(-Step))
	far, _ := Code(s, now.Add(-3*Step))
	if !Verify(s, prev, now) {
		t.Fatal("a code from the previous step should pass")
	}
	if Verify(s, far, now) && far != prev {
		t.Fatal("a code three steps old should fail")
	}
	if Verify(s, "12345", now) || Verify(s, "abcdef", now) {
		t.Fatal("malformed codes must fail")
	}
}
