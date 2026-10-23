// Package optional models PATCH fields that can be absent, set to a value, or
// explicitly cleared with JSON null.
package optional

import "encoding/json"

// Field is absent unless Set is true; Value is nil when the client sent null.
type Field[T any] struct {
	Set   bool
	Value *T
}

func (f *Field[T]) UnmarshalJSON(b []byte) error {
	f.Set = true
	if string(b) == "null" {
		f.Value = nil
		return nil
	}
	var v T
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	f.Value = &v
	return nil
}

// Of returns a set field holding v.
func Of[T any](v T) Field[T] { return Field[T]{Set: true, Value: &v} }

// Null returns a set field holding null.
func Null[T any]() Field[T] { return Field[T]{Set: true} }
