package application

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

// LLM makes single tool-free calls (no conversation, no workspace tools).
type LLM interface {
	Text(ctx context.Context, system, prompt string) (string, error)
	JSON(ctx context.Context, system, prompt string, out any) error
}

// Source is one search result an answer may cite.
type Source struct {
	Type   string `json:"type"`
	ID     string `json:"id"`
	Title  string `json:"title"`
	Key    string `json:"key,omitempty"`
	Parent string `json:"parent,omitempty"`
	Text   string `json:"-"`
}

// Retriever finds what the person can see that's relevant to a question.
type Retriever func(ctx context.Context, ws, user, question string) ([]Source, error)

type Answer struct {
	Answer  string   `json:"answer"`
	Sources []Source `json:"sources"`
}

const askSystem = `You answer questions about a team's work using ONLY the numbered sources provided (tasks, docs, chat messages, comments, meetings).
Rules:
- Cite sources inline with their number in square brackets, like [2] or [1][3]. Cite every claim.
- If the sources don't contain the answer, say so plainly and suggest where to look. Never invent facts, names or dates.
- Be concise: a short paragraph or a few bullet points. Plain text with simple markdown (bold, bullets) only.`

var markRe = regexp.MustCompile(`</?mark>`)

// Ask answers a question from the workspace's own content, with citations.
func (s *Service) Ask(ctx context.Context, ws, user, question string, llm LLM, find Retriever) (*Answer, error) {
	if llm == nil {
		return nil, ErrDisabled
	}
	question = strings.TrimSpace(question)
	if question == "" || len(question) > 1000 {
		return nil, apperror.Invalid("invalid_question", "ask a question of up to 1000 characters")
	}
	sources, err := find(ctx, ws, user, question)
	if err != nil {
		return nil, err
	}
	if len(sources) == 0 {
		return &Answer{Answer: "I couldn’t find anything in this workspace about that. Try different words, or check that the work is in a Space you can see.", Sources: []Source{}}, nil
	}
	var b strings.Builder
	for i, src := range sources {
		text := markRe.ReplaceAllString(src.Text, "")
		if len(text) > 1500 {
			text = text[:1500] + "…"
		}
		fmt.Fprintf(&b, "[%d] %s %s%s\n%s\n\n", i+1, src.Type, strings.TrimSpace(src.Key+" "), src.Title, text)
	}
	answer, err := llm.Text(ctx, askSystem, "Sources:\n\n"+b.String()+"Question: "+question)
	if err != nil {
		return nil, apperror.Unavailable("ai_failed", "the AI couldn’t answer just now; try again")
	}
	answer, cited := keepCited(answer, sources)
	return &Answer{Answer: answer, Sources: cited}, nil
}

var citeRe = regexp.MustCompile(`\[(\d+)\]`)

// keepCited drops sources the answer never cites and renumbers the rest in the
// order they first appear, so readers only see what backs the answer.
func keepCited(answer string, sources []Source) (string, []Source) {
	order := map[int]int{}
	var cited []Source
	for _, m := range citeRe.FindAllStringSubmatch(answer, -1) {
		var n int
		fmt.Sscan(m[1], &n)
		if n < 1 || n > len(sources) {
			continue
		}
		if _, ok := order[n]; !ok {
			cited = append(cited, sources[n-1])
			order[n] = len(cited)
		}
	}
	if len(cited) == 0 {
		return answer, []Source{}
	}
	return citeRe.ReplaceAllStringFunc(answer, func(m string) string {
		var n int
		fmt.Sscan(strings.Trim(m, "[]"), &n)
		if k, ok := order[n]; ok {
			return fmt.Sprintf("[%d]", k)
		}
		return ""
	}), cited
}

// MeetingSummary is what a call transcript boils down to.
type MeetingSummary struct {
	Summary     string   `json:"summary"`
	Decisions   []string `json:"decisions"`
	ActionItems []struct {
		Title string `json:"title"`
		Owner string `json:"owner"`
		Due   string `json:"due"`
	} `json:"actionItems"`
}

const summarySystem = `You turn meeting transcripts into notes. Reply with JSON only:
{"summary": "<3-5 sentence summary>", "decisions": ["..."], "actionItems": [{"title": "<imperative task, under 12 words>", "owner": "<speaker name from the transcript or empty>", "due": "<YYYY-MM-DD if a date was agreed, else empty>"}]}.
Only include decisions and action items that were actually said. Use the transcript's language.`

// Summarize turns a transcript into a summary, decisions and action items.
func (s *Service) Summarize(ctx context.Context, title, transcript string, llm LLM) (*MeetingSummary, error) {
	if llm == nil {
		return nil, ErrDisabled
	}
	transcript = strings.TrimSpace(transcript)
	if transcript == "" {
		return nil, apperror.Invalid("empty_transcript", "there's no transcript to summarize")
	}
	if len(transcript) > 60000 {
		transcript = transcript[len(transcript)-60000:] // keep the end: decisions come late
	}
	var out MeetingSummary
	if err := llm.JSON(ctx, summarySystem, "Meeting: "+title+"\n\nTranscript:\n"+transcript, &out); err != nil {
		return nil, apperror.Unavailable("ai_failed", "the AI couldn’t summarize this just now; try again")
	}
	return &out, nil
}
