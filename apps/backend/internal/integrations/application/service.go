package application

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"

	"github.com/indalyadav56/meetspace/backend/internal/integrations/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type Service struct {
	repo   domain.Repository
	gh     GitHubAPI
	cipher Cipher
	tasks  Tasks
	admins Admins
	pub    Publisher
	caps   Capabilities
	log    *zap.Logger
}

func NewService(repo domain.Repository, gh GitHubAPI, cipher Cipher, tasks Tasks, admins Admins, pub Publisher, caps Capabilities, log *zap.Logger) *Service {
	return &Service{repo: repo, gh: gh, cipher: cipher, tasks: tasks, admins: admins, pub: pub, caps: caps, log: log}
}

// Status describes every integration for the App Center.
func (s *Service) Status(ctx context.Context, ws string) (map[string]any, error) {
	c, err := s.repo.GetConnection(ctx, ws, domain.GitHub)
	if err != nil {
		return nil, err
	}
	gh := map[string]any{"connected": c != nil}
	if c != nil {
		gh["account"], gh["avatar"], gh["repos"], gh["lastSyncedAt"], gh["connectedAt"] = c.AccountLogin, c.AccountAvatar, c.Repos, c.LastSyncedAt, c.CreatedAt
	}
	out := map[string]any{domain.GitHub: gh}
	if s.caps != nil {
		for k, v := range s.caps() {
			out[k] = v
		}
	}
	return out, nil
}

func (s *Service) requireAdmin(ctx context.Context, ws, userID string) error {
	if !s.admins.CanManage(ctx, ws, userID) {
		return domain.ErrForbidden
	}
	return nil
}

// ConnectGitHub validates a personal access token and stores it encrypted.
// It returns the webhook secret so the admin can configure repository webhooks.
func (s *Service) ConnectGitHub(ctx context.Context, ws, userID, token string) (map[string]any, error) {
	if err := s.requireAdmin(ctx, ws, userID); err != nil {
		return nil, err
	}
	token = strings.TrimSpace(token)
	if token == "" || len(token) > 512 {
		return nil, domain.ErrBadToken
	}
	login, avatar, err := s.gh.User(ctx, token)
	if err != nil {
		return nil, err
	}
	sealed, err := s.cipher.Seal([]byte(token))
	if err != nil {
		return nil, err
	}
	prev, err := s.repo.GetConnection(ctx, ws, domain.GitHub)
	if err != nil {
		return nil, err
	}
	c := &domain.Connection{WorkspaceID: ws, Provider: domain.GitHub, AccountLogin: login, AccountAvatar: avatar, TokenCiphertext: sealed, Repos: []string{}, CreatedBy: &userID}
	if prev != nil {
		c.Repos, c.WebhookSecret = prev.Repos, prev.WebhookSecret
	}
	if c.WebhookSecret == "" {
		c.WebhookSecret = randomHex(24)
	}
	if err := s.repo.SaveConnection(ctx, c); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, ws, "integrations", "upsert", map[string]any{"provider": domain.GitHub}, nil)
	return s.Status(ctx, ws)
}

func (s *Service) DisconnectGitHub(ctx context.Context, ws, userID string) error {
	if err := s.requireAdmin(ctx, ws, userID); err != nil {
		return err
	}
	if err := s.repo.DeleteConnection(ctx, ws, domain.GitHub); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "integrations", "upsert", map[string]any{"provider": domain.GitHub}, nil)
	return nil
}

// WebhookSecret is shown to admins so they can add a webhook on GitHub.
func (s *Service) WebhookSecret(ctx context.Context, ws, userID string) (string, error) {
	if err := s.requireAdmin(ctx, ws, userID); err != nil {
		return "", err
	}
	c, err := s.connection(ctx, ws)
	if err != nil {
		return "", err
	}
	return c.WebhookSecret, nil
}

func (s *Service) connection(ctx context.Context, ws string) (*domain.Connection, error) {
	c, err := s.repo.GetConnection(ctx, ws, domain.GitHub)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, domain.ErrNotConnected
	}
	return c, nil
}

func (s *Service) token(c *domain.Connection) (string, error) {
	plain, err := s.cipher.Open(c.TokenCiphertext)
	if err != nil {
		return "", apperror.Unavailable("token_unreadable", "the stored GitHub token can't be decrypted; reconnect GitHub")
	}
	return string(plain), nil
}

// Repos lists repositories the connected token can access.
func (s *Service) Repos(ctx context.Context, ws string) ([]GitHubRepo, error) {
	c, err := s.connection(ctx, ws)
	if err != nil {
		return nil, err
	}
	tok, err := s.token(c)
	if err != nil {
		return nil, err
	}
	return s.gh.Repos(ctx, tok)
}

var repoRe = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

// SetRepos chooses which repositories are scanned for task references.
func (s *Service) SetRepos(ctx context.Context, ws, userID string, repos []string) (map[string]any, error) {
	if err := s.requireAdmin(ctx, ws, userID); err != nil {
		return nil, err
	}
	c, err := s.connection(ctx, ws)
	if err != nil {
		return nil, err
	}
	clean := []string{}
	seen := map[string]bool{}
	for _, r := range repos {
		r = strings.TrimSpace(r)
		if !repoRe.MatchString(r) || seen[strings.ToLower(r)] {
			continue
		}
		seen[strings.ToLower(r)] = true
		clean = append(clean, r)
	}
	if len(clean) > 50 {
		return nil, apperror.Invalid("too_many_repos", "watch at most 50 repositories")
	}
	c.Repos = clean
	if err := s.repo.SaveConnection(ctx, c); err != nil {
		return nil, err
	}
	return s.Status(ctx, ws)
}

// ---- links

func (s *Service) Links(ctx context.Context, ws, taskID string) ([]domain.Link, error) {
	return s.repo.ListLinks(ctx, ws, taskID)
}

var itemURLRe = regexp.MustCompile(`^https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/(pull|issues)/(\d+)`)

// LinkURL attaches a pull request or issue to a task by its URL.
func (s *Service) LinkURL(ctx context.Context, ws, userID, taskID, raw string) (*domain.Link, error) {
	m := itemURLRe.FindStringSubmatch(strings.TrimSpace(raw))
	if m == nil {
		return nil, domain.ErrBadURL
	}
	if !s.tasks.TaskExists(ctx, ws, taskID) {
		return nil, apperror.NotFound("task_not_found", "task not found")
	}
	c, err := s.connection(ctx, ws)
	if err != nil {
		return nil, err
	}
	tok, err := s.token(c)
	if err != nil {
		return nil, err
	}
	n, _ := strconv.Atoi(m[3])
	item, err := s.gh.Item(ctx, tok, m[1], n, m[2] == "pull")
	if err != nil {
		return nil, err
	}
	return s.attach(ctx, ws, taskID, item)
}

func (s *Service) attach(ctx context.Context, ws, taskID string, it *GitHubItem) (*domain.Link, error) {
	l := &domain.Link{WorkspaceID: ws, TaskID: taskID, Provider: domain.GitHub, Kind: it.Kind, Repo: it.Repo, Number: it.Number, Title: it.Title, URL: it.URL, State: it.State, Author: it.Author}
	created, prev, err := s.repo.UpsertLink(ctx, l)
	if err != nil {
		return nil, err
	}
	noun := map[string]string{"pull_request": "pull request", "issue": "issue"}[it.Kind]
	switch {
	case created:
		s.tasks.RecordActivity(ctx, ws, taskID, fmt.Sprintf("linked GitHub %s %s#%d “%s”", noun, it.Repo, it.Number, it.Title))
	case prev != it.State && it.State != "":
		s.tasks.RecordActivity(ctx, ws, taskID, fmt.Sprintf("GitHub %s %s#%d was %s", noun, it.Repo, it.Number, it.State))
	}
	if created || prev != it.State {
		s.pub.Publish(ctx, ws, "githubLinks", "upsert", l, nil)
	}
	return l, nil
}

func (s *Service) attachCommit(ctx context.Context, ws, taskID string, c GitHubCommit) {
	title := strings.SplitN(c.Message, "\n", 2)[0]
	short := c.SHA
	if len(short) > 7 {
		short = short[:7]
	}
	l := &domain.Link{WorkspaceID: ws, TaskID: taskID, Provider: domain.GitHub, Kind: "commit", Repo: c.Repo, Ref: short, Title: title, URL: c.URL, State: "committed", Author: c.Author}
	created, _, err := s.repo.UpsertLink(ctx, l)
	if err != nil {
		s.log.Warn("github commit link failed", zap.Error(err))
		return
	}
	if created {
		s.tasks.RecordActivity(ctx, ws, taskID, fmt.Sprintf("referenced in commit %s@%s “%s”", c.Repo, short, title))
		s.pub.Publish(ctx, ws, "githubLinks", "upsert", l, nil)
	}
}

func (s *Service) Unlink(ctx context.Context, ws, id string) error {
	l, err := s.repo.GetLink(ctx, ws, id)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteLink(ctx, ws, id); err != nil {
		return err
	}
	s.pub.Publish(ctx, ws, "githubLinks", "delete", map[string]string{"id": id, "taskId": l.TaskID}, nil)
	return nil
}

// ---- automatic linking (sync + webhooks)

var keyRe = regexp.MustCompile(`(?i)\bMS-(\d+)\b`)

// TaskKeys returns the task numbers referenced in text ("MS-123", "ms-123-fix-login").
func TaskKeys(text string) []int64 {
	var out []int64
	seen := map[int64]bool{}
	for _, m := range keyRe.FindAllStringSubmatch(text, -1) {
		if k, err := strconv.ParseInt(m[1], 10, 64); err == nil && !seen[k] {
			seen[k] = true
			out = append(out, k)
		}
	}
	return out
}

func (s *Service) linkItemByKeys(ctx context.Context, ws string, it GitHubItem) int {
	n := 0
	for _, k := range TaskKeys(it.Title + " " + it.Body + " " + it.Branch) {
		if id, ok := s.tasks.TaskIDByKey(ctx, ws, k); ok {
			it := it
			if _, err := s.attach(ctx, ws, id, &it); err == nil {
				n++
			}
		}
	}
	return n
}

func (s *Service) linkCommitByKeys(ctx context.Context, ws string, c GitHubCommit) int {
	n := 0
	for _, k := range TaskKeys(c.Message) {
		if id, ok := s.tasks.TaskIDByKey(ctx, ws, k); ok {
			s.attachCommit(ctx, ws, id, c)
			n++
		}
	}
	return n
}

// Sync scans watched repositories' recent pull requests and commits for task
// references. It works without a public webhook URL (e.g. on localhost).
func (s *Service) Sync(ctx context.Context, ws string) (int, error) {
	c, err := s.connection(ctx, ws)
	if err != nil {
		return 0, err
	}
	tok, err := s.token(c)
	if err != nil {
		return 0, err
	}
	linked := 0
	for _, repo := range c.Repos {
		pulls, err := s.gh.RecentPulls(ctx, tok, repo)
		if err != nil {
			s.log.Warn("github pulls sync failed", zap.String("repo", repo), zap.Error(err))
			continue
		}
		for _, p := range pulls {
			linked += s.linkItemByKeys(ctx, ws, p)
		}
		commits, err := s.gh.RecentCommits(ctx, tok, repo)
		if err != nil {
			s.log.Warn("github commits sync failed", zap.String("repo", repo), zap.Error(err))
			continue
		}
		for _, cm := range commits {
			linked += s.linkCommitByKeys(ctx, ws, cm)
		}
	}
	_ = s.repo.MarkSynced(ctx, ws, domain.GitHub, time.Now().UTC())
	return linked, nil
}

// SyncAll syncs every connected workspace (run periodically by the worker).
func (s *Service) SyncAll(ctx context.Context) {
	conns, err := s.repo.ListConnections(ctx, domain.GitHub)
	if err != nil {
		s.log.Warn("list github connections failed", zap.Error(err))
		return
	}
	for _, c := range conns {
		if len(c.Repos) == 0 {
			continue
		}
		if n, err := s.Sync(ctx, c.WorkspaceID); err != nil {
			s.log.Warn("github sync failed", zap.String("workspace", c.WorkspaceID), zap.Error(err))
		} else if n > 0 {
			s.log.Info("github sync linked items", zap.String("workspace", c.WorkspaceID), zap.Int("links", n))
		}
	}
}

// WebhookEvent is the part of a GitHub webhook delivery this context reads.
type WebhookEvent struct {
	PullRequest *GitHubItem
	Commits     []GitHubCommit
}

// HandleWebhook verifies the X-Hub-Signature-256 header and links referenced tasks.
func (s *Service) HandleWebhook(ctx context.Context, ws, signature string, body []byte, parse func([]byte) (*WebhookEvent, error)) (int, error) {
	c, err := s.repo.GetConnection(ctx, ws, domain.GitHub)
	if err != nil {
		return 0, err
	}
	if c == nil || !validSignature(c.WebhookSecret, signature, body) {
		return 0, apperror.Unauthorized("invalid_signature", "webhook signature does not match")
	}
	ev, err := parse(body)
	if err != nil || ev == nil {
		return 0, err
	}
	n := 0
	if ev.PullRequest != nil {
		n += s.linkItemByKeys(ctx, ws, *ev.PullRequest)
	}
	for _, cm := range ev.Commits {
		n += s.linkCommitByKeys(ctx, ws, cm)
	}
	return n, nil
}

func validSignature(secret, header string, body []byte) bool {
	const prefix = "sha256="
	if secret == "" || !strings.HasPrefix(header, prefix) {
		return false
	}
	got, err := hex.DecodeString(header[len(prefix):])
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hmac.Equal(got, mac.Sum(nil))
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// RunSync syncs every connected workspace on an interval until ctx ends.
func (s *Service) RunSync(ctx context.Context, every time.Duration) error {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			s.SyncAll(ctx)
		}
	}
}
