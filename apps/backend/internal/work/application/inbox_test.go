package application

import "testing"

func TestTextToHTMLDropsQuotedReplies(t *testing.T) {
	in := "Please fix the <login> page.\n\nSteps below.\n\nOn Mon, Oct 27, 2026 Ana wrote:\n> old stuff"
	got := textToHTML(in)
	want := "<p>Please fix the &lt;login&gt; page.</p><p>Steps below.</p>"
	if got != want {
		t.Fatalf("got %q", got)
	}
}

func TestReplyPrefixIsStripped(t *testing.T) {
	for in, want := range map[string]string{"Re: Fwd: Bug": "Bug", "FW: RE: Invoice": "Invoice", "Report": "Report"} {
		if got := replyPrefix.ReplaceAllString(in, ""); got != want {
			t.Errorf("%q → %q, want %q", in, got, want)
		}
	}
}
