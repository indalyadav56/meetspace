package secretbox

import "testing"

func TestRoundTripAndTamper(t *testing.T) {
	b, err := FromPassphrase("dev-secret")
	if err != nil {
		t.Fatal(err)
	}
	sealed, err := b.Seal([]byte("ghp_example"))
	if err != nil {
		t.Fatal(err)
	}
	got, err := b.Open(sealed)
	if err != nil || string(got) != "ghp_example" {
		t.Fatalf("got %q, %v", got, err)
	}
	sealed[len(sealed)-1] ^= 1
	if _, err := b.Open(sealed); err == nil {
		t.Fatal("tampered ciphertext was accepted")
	}
	other, _ := FromPassphrase("other")
	if _, err := other.Open(sealed); err == nil {
		t.Fatal("wrong key was accepted")
	}
}
