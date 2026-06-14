// Package password hashes and verifies passwords. It wraps bcrypt behind a
// small interface so the algorithm can be swapped and so services can be tested
// with a fake hasher.
package password

import "golang.org/x/crypto/bcrypt"

// MaxLength is bcrypt's hard input limit. Inputs longer than this are silently
// truncated by bcrypt, so callers should reject longer passwords up front.
const MaxLength = 72

// Hasher hashes plaintext passwords and verifies them against a stored hash.
type Hasher interface {
	// Hash returns a salted hash of plain suitable for storage.
	Hash(plain string) (string, error)
	// Compare reports whether plain matches the stored hash. It returns nil on
	// a match and a non-nil error otherwise.
	Compare(hash, plain string) error
}

// BcryptHasher implements Hasher using bcrypt at a configurable cost.
type BcryptHasher struct {
	cost int
}

// NewBcryptHasher returns a hasher at the given cost. Costs outside bcrypt's
// valid range fall back to bcrypt.DefaultCost.
func NewBcryptHasher(cost int) *BcryptHasher {
	if cost < bcrypt.MinCost || cost > bcrypt.MaxCost {
		cost = bcrypt.DefaultCost
	}
	return &BcryptHasher{cost: cost}
}

// NewDefaultBcryptHasher returns a hasher at bcrypt.DefaultCost.
func NewDefaultBcryptHasher() *BcryptHasher {
	return NewBcryptHasher(bcrypt.DefaultCost)
}

// Hash implements Hasher.
func (h *BcryptHasher) Hash(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), h.cost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Compare implements Hasher.
func (h *BcryptHasher) Compare(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}
