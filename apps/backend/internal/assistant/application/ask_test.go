package application

import "testing"

func TestKeepCitedRenumbers(t *testing.T) {
	src := []Source{{ID: "a"}, {ID: "b"}, {ID: "c"}, {ID: "d"}}
	got, cited := keepCited("Calls work [3]. Self-hosting is planned [1][3]. Webhooks [9].", src)
	if got != "Calls work [1]. Self-hosting is planned [2][1]. Webhooks ." || len(cited) != 2 || cited[0].ID != "c" || cited[1].ID != "a" {
		t.Fatalf("%q %+v", got, cited)
	}
	if _, none := keepCited("No sources say.", src); len(none) != 0 {
		t.Fatal("an answer with no citations shows no sources")
	}
}
