package password

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestBcryptHasher_HashAndCompare(t *testing.T) {
	h := NewBcryptHasher(bcrypt.MinCost)

	hash, err := h.Hash("s3cret-password")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if hash == "s3cret-password" {
		t.Fatal("hash must not equal the plaintext")
	}
	if err := h.Compare(hash, "s3cret-password"); err != nil {
		t.Errorf("compare should match: %v", err)
	}
	if err := h.Compare(hash, "wrong-password"); err == nil {
		t.Error("compare should fail for the wrong password")
	}
}

func TestBcryptHasher_DistinctHashesForSameInput(t *testing.T) {
	h := NewBcryptHasher(bcrypt.MinCost)
	a, _ := h.Hash("same")
	b, _ := h.Hash("same")
	if a == b {
		t.Error("bcrypt should salt, producing different hashes for the same input")
	}
}
