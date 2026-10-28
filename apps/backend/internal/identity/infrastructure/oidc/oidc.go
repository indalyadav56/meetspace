// Package oidc signs people in through OpenID Connect providers (Google, Okta,
// Microsoft Entra, Auth0, Keycloak…) with the authorization-code flow and PKCE.
package oidc

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Provider is one configured identity provider.
type Provider struct {
	ID, Name     string
	Issuer       string
	ClientID     string
	ClientSecret string

	mu   sync.Mutex
	disc *discovery
}

type discovery struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
}

// Claims is the subset of the userinfo response we use.
type Claims struct {
	Subject       string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified any    `json:"email_verified"` // some providers send "true"
	Name          string `json:"name"`
}

func (c Claims) Verified() bool {
	switch v := c.EmailVerified.(type) {
	case bool:
		return v
	case string:
		return v == "true"
	}
	return false
}

var client = &http.Client{Timeout: 10 * time.Second}

func (p *Provider) discover(ctx context.Context) (discovery, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.disc != nil {
		return *p.disc, nil
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(p.Issuer, "/")+"/.well-known/openid-configuration", nil)
	res, err := client.Do(req)
	if err != nil {
		return discovery{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return discovery{}, fmt.Errorf("oidc discovery: %s", res.Status)
	}
	var d discovery
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&d); err != nil {
		return discovery{}, err
	}
	if d.AuthorizationEndpoint == "" || d.TokenEndpoint == "" || d.UserinfoEndpoint == "" {
		return discovery{}, errors.New("oidc discovery: provider is missing an endpoint")
	}
	// Only a successful discovery is cached, so a failure is retried next time.
	p.disc = &d
	return d, nil
}

// NewVerifier returns a PKCE code verifier.
func NewVerifier() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func challenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// AuthURL is where the browser goes to sign in.
func (p *Provider) AuthURL(ctx context.Context, redirectURI, state, verifier string) (string, error) {
	d, err := p.discover(ctx)
	if err != nil {
		return "", err
	}
	q := url.Values{
		"response_type": {"code"}, "client_id": {p.ClientID}, "redirect_uri": {redirectURI},
		"scope": {"openid email profile"}, "state": {state},
		"code_challenge": {challenge(verifier)}, "code_challenge_method": {"S256"}, "prompt": {"select_account"},
	}
	return d.AuthorizationEndpoint + "?" + q.Encode(), nil
}

// Exchange trades the callback code for the person's claims.
func (p *Provider) Exchange(ctx context.Context, code, redirectURI, verifier string) (Claims, error) {
	d, err := p.discover(ctx)
	if err != nil {
		return Claims{}, err
	}
	form := url.Values{
		"grant_type": {"authorization_code"}, "code": {code}, "redirect_uri": {redirectURI},
		"client_id": {p.ClientID}, "client_secret": {p.ClientSecret}, "code_verifier": {verifier},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, d.TokenEndpoint, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return Claims{}, err
	}
	defer res.Body.Close()
	var tok struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&tok); err != nil {
		return Claims{}, err
	}
	if tok.AccessToken == "" {
		return Claims{}, fmt.Errorf("oidc token: %s %s", tok.Error, tok.Description)
	}
	req, _ = http.NewRequestWithContext(ctx, http.MethodGet, d.UserinfoEndpoint, nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	res, err = client.Do(req)
	if err != nil {
		return Claims{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return Claims{}, fmt.Errorf("oidc userinfo: %s", res.Status)
	}
	var c Claims
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&c); err != nil {
		return Claims{}, err
	}
	if c.Subject == "" {
		return Claims{}, errors.New("oidc userinfo: no subject")
	}
	return c, nil
}
