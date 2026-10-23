package optional

import (
	"encoding/json"
	"testing"
)

func TestFieldStates(t *testing.T) {
	var v struct {
		A Field[string] `json:"a"`
		B Field[string] `json:"b"`
		C Field[string] `json:"c"`
	}
	if err := json.Unmarshal([]byte(`{"a":"x","b":null}`), &v); err != nil {
		t.Fatal(err)
	}
	if !v.A.Set || v.A.Value == nil || *v.A.Value != "x" {
		t.Fatalf("a = %+v", v.A)
	}
	if !v.B.Set || v.B.Value != nil {
		t.Fatalf("b should be explicitly null, got %+v", v.B)
	}
	if v.C.Set {
		t.Fatalf("c should be absent")
	}
}
