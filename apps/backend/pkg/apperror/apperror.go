// Package apperror defines transport-agnostic application errors that carry a
// stable machine code and an HTTP-ish kind. Services return them; transports
// map them to status codes.
package apperror

import (
	"errors"
	"fmt"
)

// Kind classifies an error for transport mapping.
type Kind int

const (
	KindInternal Kind = iota
	KindNotFound
	KindInvalid
	KindConflict
	KindUnauthorized
	KindForbidden
	KindUnavailable
	KindTooMany
)

// Error is an application error with a stable code.
type Error struct {
	Kind    Kind
	Code    string
	Message string
	Err     error
}

func (e *Error) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.Err }

func newErr(k Kind, code, msg string) *Error { return &Error{Kind: k, Code: code, Message: msg} }

func NotFound(code, msg string) *Error     { return newErr(KindNotFound, code, msg) }
func Invalid(code, msg string) *Error      { return newErr(KindInvalid, code, msg) }
func Conflict(code, msg string) *Error     { return newErr(KindConflict, code, msg) }
func Unauthorized(code, msg string) *Error { return newErr(KindUnauthorized, code, msg) }
func Forbidden(code, msg string) *Error    { return newErr(KindForbidden, code, msg) }
func Unavailable(code, msg string) *Error  { return newErr(KindUnavailable, code, msg) }
func TooMany(code, msg string) *Error      { return newErr(KindTooMany, code, msg) }

// As extracts an *Error from err.
func As(err error) (*Error, bool) {
	var e *Error
	if errors.As(err, &e) {
		return e, true
	}
	return nil, false
}

// IsKind reports whether err is an *Error of kind k.
func IsKind(err error, k Kind) bool {
	e, ok := As(err)
	return ok && e.Kind == k
}
