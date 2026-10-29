package di

import (
	"context"
	"fmt"
	"sort"
	"strings"

	assistantapp "github.com/indalyadav56/meetspace/backend/internal/assistant/application"
	"github.com/indalyadav56/meetspace/backend/internal/assistant/infrastructure/gemini"
	chatapp "github.com/indalyadav56/meetspace/backend/internal/chat/application"
	searchapp "github.com/indalyadav56/meetspace/backend/internal/search/application"
	searchdomain "github.com/indalyadav56/meetspace/backend/internal/search/domain"
	workapp "github.com/indalyadav56/meetspace/backend/internal/work/application"
)

// geminiTriager adapts the one-shot Gemini client to the work context's Triager port.
type geminiTriager struct{ llm *gemini.Client }

func (g geminiTriager) Triage(ctx context.Context, in workapp.TriageInput) (*workapp.Triage, error) {
	ids := make([]string, 0, len(in.People))
	for id := range in.People {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	var people strings.Builder
	for _, id := range ids {
		fmt.Fprintf(&people, "- %s: %s\n", id, in.People[id])
	}
	desc := in.Description
	if len(desc) > 3000 {
		desc = desc[:3000]
	}
	prompt := fmt.Sprintf("Task title: %s\nDescription: %s\n\nPeople (id: name):\n%s\nTags in use: %s\n", in.Title, desc, people.String(), strings.Join(in.Tags, ", "))
	if in.Instructions != "" {
		prompt += "\nTeam instructions: " + in.Instructions + "\n"
	}
	var out workapp.Triage
	if err := g.llm.JSON(ctx, gemini.TriageSystem, prompt, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// searchRetriever finds sources for "ask the workspace", respecting what the
// person can see (search already drops private Spaces and others' DMs).
func searchRetriever(search *searchapp.Service) assistantapp.Retriever {
	return func(ctx context.Context, ws, user, question string) ([]assistantapp.Source, error) {
		if !search.Enabled() {
			return nil, nil
		}
		res, err := search.Search(ctx, searchdomain.Query{WorkspaceID: ws, UserID: user, Text: question, Limit: 8, WithBody: true})
		if err != nil {
			return nil, err
		}
		out := make([]assistantapp.Source, 0, len(res.Hits))
		for _, h := range res.Hits {
			text := h.Body
			if text == "" {
				text = h.Snippet
			}
			out = append(out, assistantapp.Source{Type: h.Type, ID: h.EntityID, Title: h.Title, Key: h.Key, Parent: h.Parent, Text: text})
		}
		return out, nil
	}
}

// chatPoster posts a scheduled agent's report into its channel as the agent's owner.
func chatPoster(chat *chatapp.Service) assistantapp.Poster {
	return func(ctx context.Context, ws, userID, channelID, text string) error {
		_, err := chat.Send(ctx, ws, userID, chatapp.SendInput{ChannelID: channelID, Text: text})
		return err
	}
}

// askLLM hands the assistant the one-shot client, or nil when AI is off.
func askLLM(c *gemini.Client) assistantapp.LLM {
	if c == nil {
		return nil
	}
	return c
}
