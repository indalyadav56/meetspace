// Package gemini makes single, tool-free calls to Gemini: short answers and
// structured JSON for features such as triage and "ask the workspace".
package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"google.golang.org/genai"
)

type Client struct {
	c     *genai.Client
	model string
}

func New(ctx context.Context, apiKey, model string) (*Client, error) {
	c, err := genai.NewClient(ctx, &genai.ClientConfig{APIKey: apiKey, Backend: genai.BackendGeminiAPI})
	if err != nil {
		return nil, fmt.Errorf("gemini client: %w", err)
	}
	return &Client{c: c, model: model}, nil
}

// Text returns a plain-text answer.
func (g *Client) Text(ctx context.Context, system, prompt string) (string, error) {
	res, err := g.c.Models.GenerateContent(ctx, g.model, genai.Text(prompt), &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(system, genai.RoleUser),
		Temperature:       genai.Ptr[float32](0.2),
	})
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(res.Text()), nil
}

// JSON fills out with the model's JSON answer.
func (g *Client) JSON(ctx context.Context, system, prompt string, out any) error {
	res, err := g.c.Models.GenerateContent(ctx, g.model, genai.Text(prompt), &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(system, genai.RoleUser),
		ResponseMIMEType:  "application/json",
		Temperature:       genai.Ptr[float32](0.1),
	})
	if err != nil {
		return err
	}
	raw := strings.TrimSpace(res.Text())
	raw = strings.TrimSuffix(strings.TrimPrefix(strings.TrimPrefix(raw, "```json"), "```"), "```")
	return json.Unmarshal([]byte(raw), out)
}

// TriageSystem instructs the model for task triage.
const TriageSystem = `You triage new work items for a software/product team.
Reply with JSON only: {"priority": "urgent|high|normal|low|", "tags": ["..."], "assignee": "<person id or empty>", "reason": "<one short sentence>"}.
- priority: urgent only for outages, security issues or hard deadlines today; high for user-facing bugs or blockers; otherwise normal or low. Leave "" if you can't tell.
- tags: up to 3, lowercase, prefer existing tags; [] if none fit.
- assignee: pick the best person only when the task clearly matches someone's area (by name or past context); otherwise "".
- Follow any team instructions given.`
