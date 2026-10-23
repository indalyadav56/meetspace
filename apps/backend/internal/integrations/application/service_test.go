package application

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"reflect"
	"testing"
)

func TestTaskKeys(t *testing.T) {
	got := TaskKeys("Fix login (MS-12) on branch ms-130-oauth; also MS-12 again, not MS12 or XMS-9")
	if want := []int64{12, 130}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestValidSignature(t *testing.T) {
	body := []byte(`{"action":"opened"}`)
	mac := hmac.New(sha256.New, []byte("s3cret"))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !validSignature("s3cret", sig, body) {
		t.Fatal("valid signature rejected")
	}
	if validSignature("other", sig, body) || validSignature("s3cret", sig, []byte("{}")) || validSignature("s3cret", "sha1=abc", body) || validSignature("", sig, body) {
		t.Fatal("invalid signature accepted")
	}
}
