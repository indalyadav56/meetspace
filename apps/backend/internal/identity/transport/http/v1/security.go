package v1

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/identity/application"
	"github.com/indalyadav56/meetspace/backend/internal/identity/infrastructure/oidc"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type mfaReq struct {
	MFAToken string `json:"mfaToken" binding:"required"`
	Code     string `json:"code" binding:"required"`
}

// LoginMFA finishes a password or SSO sign-in with a 2FA code.
func (h *Handler) LoginMFA(c *gin.Context) {
	var req mfaReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	u, pair, usedRecovery, err := h.auth.CompleteMFA(ctx(c), req.MFAToken, req.Code)
	if err != nil {
		if u != nil {
			h.record(c, u.ID, "auth.mfa_failed", nil)
		}
		response.FromError(c, err)
		return
	}
	method := "totp"
	if usedRecovery {
		method = "recovery_code"
	}
	h.record(c, u.ID, "auth.login", map[string]any{"method": "password+" + method})
	response.Data(c, http.StatusOK, authResp{User: application.Profile{ID: u.ID, Name: u.FullName, Email: u.Email, Color: u.Color}, Tokens: pair})
}

type codeReq struct {
	Code     string `json:"code"`
	Password string `json:"password"`
}

func (h *Handler) twoFactor(c *gin.Context) {
	st, err := h.auth.TwoFactor(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, st)
}

func (h *Handler) setupTOTP(c *gin.Context) {
	secret, otpURL, err := h.auth.SetupTOTP(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, gin.H{"secret": secret, "otpauthUrl": otpURL})
}

func (h *Handler) enableTOTP(c *gin.Context) {
	var req codeReq
	_ = c.ShouldBindJSON(&req)
	codes, err := h.auth.EnableTOTP(c.Request.Context(), authctx.UserID(c), req.Code)
	if err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, authctx.UserID(c), "auth.2fa_enabled", nil)
	response.Data(c, http.StatusOK, gin.H{"recoveryCodes": codes})
}

func (h *Handler) disableTOTP(c *gin.Context) {
	var req codeReq
	_ = c.ShouldBindJSON(&req)
	if err := h.auth.DisableTOTP(c.Request.Context(), authctx.UserID(c), req.Password, req.Code); err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, authctx.UserID(c), "auth.2fa_disabled", nil)
	response.NoContent(c)
}

func (h *Handler) regenerateRecovery(c *gin.Context) {
	var req codeReq
	_ = c.ShouldBindJSON(&req)
	codes, err := h.auth.RegenerateRecovery(c.Request.Context(), authctx.UserID(c), req.Code)
	if err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, authctx.UserID(c), "auth.recovery_codes_regenerated", nil)
	response.Data(c, http.StatusOK, gin.H{"recoveryCodes": codes})
}

func (h *Handler) sessions(c *gin.Context) {
	list, err := h.auth.Sessions(c.Request.Context(), authctx.UserID(c), authctx.SessionID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, list)
}

func (h *Handler) revokeSession(c *gin.Context) {
	if err := h.auth.RevokeSession(c.Request.Context(), authctx.UserID(c), c.Param("sid")); err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, authctx.UserID(c), "auth.session_revoked", nil)
	response.NoContent(c)
}

func (h *Handler) revokeOthers(c *gin.Context) {
	n, err := h.auth.RevokeOtherSessions(c.Request.Context(), authctx.UserID(c), authctx.SessionID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	h.record(c, authctx.UserID(c), "auth.sessions_revoked", map[string]any{"count": n})
	response.Data(c, http.StatusOK, gin.H{"revoked": n})
}

func (h *Handler) identities(c *gin.Context) {
	list, err := h.auth.LinkedAccounts(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, list)
}

/* ───────────── single sign-on ───────────── */

const oauthCookie = "ms_oauth"

func (h *Handler) provider(id string) *oidc.Provider {
	for _, p := range h.providers {
		if p.ID == id {
			return p
		}
	}
	return nil
}

// Providers lists the sign-in options the login page should offer.
func (h *Handler) Providers(c *gin.Context) {
	out := []gin.H{}
	for _, p := range h.providers {
		out = append(out, gin.H{"id": p.ID, "name": p.Name})
	}
	response.Data(c, http.StatusOK, out)
}

func (h *Handler) callbackURL(id string) string { return h.webURL + "/api/v1/auth/oauth/" + id + "/callback" }

// safePath keeps post-login redirects on this site.
func safePath(p string) string {
	if !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") || strings.Contains(p, "\\") {
		return "/app"
	}
	return p
}

// OAuthStart sends the browser to the provider. The PKCE verifier and a nonce
// ride in a short-lived HttpOnly cookie; the signed state carries the rest.
func (h *Handler) OAuthStart(c *gin.Context) {
	p := h.provider(c.Param("provider"))
	if p == nil {
		response.FromError(c, apperror.NotFound("unknown_provider", "that sign-in provider isn't set up"))
		return
	}
	verifier, nonce := oidc.NewVerifier(), oidc.NewVerifier()
	state := h.auth.OAuthState(p.ID, safePath(c.Query("redirect")), nonce)
	to, err := p.AuthURL(c.Request.Context(), h.callbackURL(p.ID), state, verifier)
	if err != nil {
		h.finishOAuth(c, url.Values{"error": {"Couldn't reach " + p.Name + ". Try again in a moment."}})
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{Name: oauthCookie, Value: nonce + "." + verifier, Path: "/api/v1/auth/oauth", MaxAge: 600, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: strings.HasPrefix(h.webURL, "https://")})
	c.Redirect(http.StatusFound, to)
}

// OAuthCallback completes sign-in and hands tokens to the web app in the URL
// fragment, which never reaches a server log.
func (h *Handler) OAuthCallback(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{Name: oauthCookie, Value: "", Path: "/api/v1/auth/oauth", MaxAge: -1, HttpOnly: true})
	if e := c.Query("error"); e != "" {
		h.finishOAuth(c, url.Values{"error": {"Sign-in was cancelled."}})
		return
	}
	providerID, redirect, nonce, err := h.auth.ParseOAuthState(c.Query("state"))
	cookie, _ := c.Cookie(oauthCookie)
	gotNonce, verifier, _ := strings.Cut(cookie, ".")
	p := h.provider(providerID)
	if err != nil || p == nil || p.ID != c.Param("provider") || gotNonce == "" || gotNonce != nonce {
		h.finishOAuth(c, url.Values{"error": {"That sign-in link expired. Please try again."}})
		return
	}
	claims, err := p.Exchange(c.Request.Context(), c.Query("code"), h.callbackURL(p.ID), verifier)
	if err != nil {
		h.finishOAuth(c, url.Values{"error": {"Couldn't finish signing in with " + p.Name + "."}})
		return
	}
	u, pair, created, err := h.auth.SSOLogin(ctx(c), application.SSOProfile{Provider: p.ID, Subject: claims.Subject, Email: claims.Email, Name: claims.Name, EmailVerified: claims.Verified()})
	var mfa *application.MFARequired
	switch {
	case errors.As(err, &mfa):
		h.finishOAuth(c, url.Values{"mfa": {mfa.Token}, "redirect": {redirect}})
	case err != nil:
		msg := "Couldn't sign you in."
		if ae, ok := apperror.As(err); ok {
			msg = ae.Message
		}
		h.finishOAuth(c, url.Values{"error": {msg}})
	default:
		action := "auth.login"
		if created {
			action = "auth.registered"
		}
		h.record(c, u.ID, action, map[string]any{"method": "sso:" + p.ID})
		h.finishOAuth(c, url.Values{
			"access": {pair.AccessToken}, "refresh": {pair.RefreshToken}, "expiresIn": {strconv.FormatInt(pair.ExpiresIn, 10)},
			"redirect": {redirect},
		})
	}
}

func (h *Handler) finishOAuth(c *gin.Context, v url.Values) {
	c.Header("Cache-Control", "no-store")
	c.Redirect(http.StatusFound, h.webURL+"/auth/callback#"+v.Encode())
}
