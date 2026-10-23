// Package github is a small GitHub REST API client for the integrations context.
package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/integrations/application"
	"github.com/indalyadav56/meetspace/backend/internal/integrations/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Client struct {
	base string
	http *http.Client
}

func New() *Client {
	return &Client{base: "https://api.github.com", http: &http.Client{Timeout: 15 * time.Second}}
}

func (c *Client) get(ctx context.Context, token, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "Meetspace")
	res, err := c.http.Do(req)
	if err != nil {
		return apperror.Unavailable("github_unreachable", "couldn't reach GitHub")
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized:
		return domain.ErrBadToken
	case res.StatusCode == http.StatusNotFound:
		return apperror.NotFound("github_not_found", "GitHub couldn't find that item, or the token can't see it")
	case res.StatusCode == http.StatusForbidden && res.Header.Get("X-RateLimit-Remaining") == "0":
		return apperror.TooMany("github_rate_limited", "GitHub rate limit reached; try again later")
	case res.StatusCode >= 300:
		return apperror.Unavailable("github_error", fmt.Sprintf("GitHub returned %d", res.StatusCode))
	}
	return json.NewDecoder(res.Body).Decode(out)
}

type user struct {
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

func (c *Client) User(ctx context.Context, token string) (string, string, error) {
	var u user
	if err := c.get(ctx, token, "/user", &u); err != nil {
		return "", "", err
	}
	return u.Login, u.AvatarURL, nil
}

func (c *Client) Repos(ctx context.Context, token string) ([]application.GitHubRepo, error) {
	var raw []struct {
		FullName string `json:"full_name"`
		Private  bool   `json:"private"`
		HTMLURL  string `json:"html_url"`
	}
	if err := c.get(ctx, token, "/user/repos?per_page=100&sort=updated", &raw); err != nil {
		return nil, err
	}
	out := make([]application.GitHubRepo, len(raw))
	for i, r := range raw {
		out[i] = application.GitHubRepo{FullName: r.FullName, Private: r.Private, URL: r.HTMLURL}
	}
	return out, nil
}

// PullRequest and Issue share the fields we need.
type pull struct {
	Number    int        `json:"number"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	HTMLURL   string     `json:"html_url"`
	State     string     `json:"state"`
	MergedAt  *time.Time `json:"merged_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	User      user       `json:"user"`
	Head      struct {
		Ref string `json:"ref"`
	} `json:"head"`
}

// ToItem converts a pull request (or issue, when isPull is false) payload.
func (p pull) ToItem(repo string, isPull bool) application.GitHubItem {
	state := p.State
	if isPull && p.MergedAt != nil {
		state = "merged"
	}
	kind := "issue"
	if isPull {
		kind = "pull_request"
	}
	return application.GitHubItem{Kind: kind, Repo: repo, Number: p.Number, Title: p.Title, Body: p.Body, Branch: p.Head.Ref, URL: p.HTMLURL, State: state, Author: p.User.Login, UpdatedAt: p.UpdatedAt}
}

func repoPath(repo string) string {
	owner, name, _ := strings.Cut(repo, "/")
	return url.PathEscape(owner) + "/" + url.PathEscape(name)
}

func (c *Client) Item(ctx context.Context, token, repo string, number int, isPull bool) (*application.GitHubItem, error) {
	kind := "issues"
	if isPull {
		kind = "pulls"
	}
	var p pull
	if err := c.get(ctx, token, "/repos/"+repoPath(repo)+"/"+kind+"/"+strconv.Itoa(number), &p); err != nil {
		return nil, err
	}
	it := p.ToItem(repo, isPull)
	return &it, nil
}

func (c *Client) RecentPulls(ctx context.Context, token, repo string) ([]application.GitHubItem, error) {
	var raw []pull
	if err := c.get(ctx, token, "/repos/"+repoPath(repo)+"/pulls?state=all&sort=updated&direction=desc&per_page=30", &raw); err != nil {
		return nil, err
	}
	out := make([]application.GitHubItem, len(raw))
	for i, p := range raw {
		out[i] = p.ToItem(repo, true)
	}
	return out, nil
}

type commit struct {
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
	Commit  struct {
		Message string `json:"message"`
		Author  struct {
			Name string `json:"name"`
		} `json:"author"`
	} `json:"commit"`
}

func (c *Client) RecentCommits(ctx context.Context, token, repo string) ([]application.GitHubCommit, error) {
	var raw []commit
	if err := c.get(ctx, token, "/repos/"+repoPath(repo)+"/commits?per_page=30", &raw); err != nil {
		return nil, err
	}
	out := make([]application.GitHubCommit, len(raw))
	for i, cm := range raw {
		out[i] = application.GitHubCommit{Repo: repo, SHA: cm.SHA, Message: cm.Commit.Message, URL: cm.HTMLURL, Author: cm.Commit.Author.Name}
	}
	return out, nil
}

// ParseWebhook reads pull_request and push deliveries; other events yield an empty event.
func ParseWebhook(event string) func([]byte) (*application.WebhookEvent, error) {
	return func(body []byte) (*application.WebhookEvent, error) {
		switch event {
		case "pull_request":
			var p struct {
				PullRequest pull `json:"pull_request"`
				Repository  struct {
					FullName string `json:"full_name"`
				} `json:"repository"`
			}
			if err := json.Unmarshal(body, &p); err != nil {
				return nil, apperror.Invalid("invalid_payload", "unreadable webhook payload")
			}
			it := p.PullRequest.ToItem(p.Repository.FullName, true)
			return &application.WebhookEvent{PullRequest: &it}, nil
		case "push":
			var p struct {
				Commits []struct {
					ID      string `json:"id"`
					Message string `json:"message"`
					URL     string `json:"url"`
					Author  struct {
						Name string `json:"name"`
					} `json:"author"`
				} `json:"commits"`
				Repository struct {
					FullName string `json:"full_name"`
				} `json:"repository"`
			}
			if err := json.Unmarshal(body, &p); err != nil {
				return nil, apperror.Invalid("invalid_payload", "unreadable webhook payload")
			}
			ev := &application.WebhookEvent{}
			for _, cm := range p.Commits {
				ev.Commits = append(ev.Commits, application.GitHubCommit{Repo: p.Repository.FullName, SHA: cm.ID, Message: cm.Message, URL: cm.URL, Author: cm.Author.Name})
			}
			return ev, nil
		default:
			return &application.WebhookEvent{}, nil
		}
	}
}
