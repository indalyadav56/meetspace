package application

import (
	"context"
	"time"
)

// GitHubRepo is a repository the token can see.
type GitHubRepo struct {
	FullName string `json:"fullName"`
	Private  bool   `json:"private"`
	URL      string `json:"url"`
}

// GitHubItem is a pull request or issue as returned by the API.
type GitHubItem struct {
	Kind      string // pull_request | issue
	Repo      string
	Number    int
	Title     string
	Body      string
	Branch    string
	URL       string
	State     string // open | closed | merged
	Author    string
	UpdatedAt time.Time
}

// GitHubCommit is a commit on a watched repository.
type GitHubCommit struct {
	Repo    string
	SHA     string
	Message string
	URL     string
	Author  string
}

// GitHubAPI is the subset of the GitHub REST API this context uses.
type GitHubAPI interface {
	User(ctx context.Context, token string) (login, avatar string, err error)
	Repos(ctx context.Context, token string) ([]GitHubRepo, error)
	Item(ctx context.Context, token, repo string, number int, pull bool) (*GitHubItem, error)
	RecentPulls(ctx context.Context, token, repo string) ([]GitHubItem, error)
	RecentCommits(ctx context.Context, token, repo string) ([]GitHubCommit, error)
}

// Cipher encrypts tokens at rest.
type Cipher interface {
	Seal(plain []byte) ([]byte, error)
	Open(sealed []byte) ([]byte, error)
}

// Tasks resolves task keys (MS-123) and records integration activity.
type Tasks interface {
	TaskIDByKey(ctx context.Context, workspaceID string, key int64) (string, bool)
	TaskExists(ctx context.Context, workspaceID, taskID string) bool
	RecordActivity(ctx context.Context, workspaceID, taskID, text string)
}

// Admins answers whether a user may manage the workspace's integrations.
type Admins interface {
	CanManage(ctx context.Context, workspaceID, userID string) bool
}

type Publisher interface {
	Publish(ctx context.Context, workspaceID, collection, op string, payload any, audience []string)
}

// Capabilities reports server-side integrations an admin configures (email, calls, AI).
type Capabilities func() map[string]any
