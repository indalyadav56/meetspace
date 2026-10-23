// Package pgjson adapts arbitrary Go values to Postgres JSONB columns for
// database/sql: wrap a destination in Scan(&v) or a value in Value(v).
package pgjson

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

type valuer struct{ v any }

// Value marshals v to JSON for a JSONB parameter. Nil slices become [] so
// columns declared NOT NULL DEFAULT '[]' never receive null.
func Value(v any) driver.Valuer { return valuer{v} }

func (j valuer) Value() (driver.Value, error) {
	b, err := json.Marshal(j.v)
	if err != nil {
		return nil, err
	}
	if string(b) == "null" {
		return []byte("[]"), nil
	}
	return b, nil
}

type scanner struct{ dst any }

// Scan returns a sql.Scanner that unmarshals a JSONB column into dst.
func Scan(dst any) *scanner { return &scanner{dst} }

func (s *scanner) Scan(src any) error {
	switch b := src.(type) {
	case nil:
		return nil
	case []byte:
		return json.Unmarshal(b, s.dst)
	case string:
		return json.Unmarshal([]byte(b), s.dst)
	default:
		return fmt.Errorf("pgjson: unsupported source type %T", src)
	}
}
