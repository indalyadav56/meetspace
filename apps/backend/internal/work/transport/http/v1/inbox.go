package v1

import (
	"crypto/subtle"
	"errors"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/work/application"
	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// WithInbound turns on email-to-task for addresses at domain.
func (h *Handler) WithInbound(domain, secret string, lookup application.UserLookup) *Handler {
	h.inboundDomain, h.inboundSecret, h.lookup = strings.ToLower(strings.TrimSpace(domain)), secret, lookup
	return h
}

func (h *Handler) inboxInfo(c *gin.Context, tok string) gin.H {
	out := gin.H{"configured": h.inboundDomain != "" && h.inboundSecret != "", "address": nil}
	if tok != "" && h.inboundDomain != "" {
		out["address"] = tok + "@" + h.inboundDomain
	}
	return out
}

func (h *Handler) getInbox(c *gin.Context) {
	tok, err := h.svc.ListInbox(c.Request.Context(), ws(c), actor(c), c.Param("id"), false, false)
	if err != nil && !errors.Is(err, domain.ErrInboxNotFound) {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, h.inboxInfo(c, tok))
}

func (h *Handler) enableInbox(c *gin.Context) {
	tok, err := h.svc.ListInbox(c.Request.Context(), ws(c), actor(c), c.Param("id"), true, c.Query("rotate") == "1")
	respond(c, http.StatusOK, h.inboxInfo(c, tok), err)
}

func (h *Handler) disableInbox(c *gin.Context) {
	respond(c, http.StatusNoContent, nil, h.svc.DisableInbox(c.Request.Context(), ws(c), actor(c), c.Param("id")))
}

var tagRe = regexp.MustCompile(`<[^>]+>`)

// parseInbound reads the webhook formats of common providers: Postmark and
// generic JSON, Mailgun and SendGrid form posts.
func parseInbound(c *gin.Context) application.InboundEmail {
	var m application.InboundEmail
	pick := func(get func(string) string, keys ...string) string {
		for _, k := range keys {
			if v := strings.TrimSpace(get(k)); v != "" {
				return v
			}
		}
		return ""
	}
	var htmlBody string
	if strings.HasPrefix(c.ContentType(), "application/json") {
		raw, _ := io.ReadAll(io.LimitReader(c.Request.Body, 5<<20))
		var j map[string]any
		_ = json.Unmarshal(raw, &j)
		get := func(k string) string {
			switch v := j[k].(type) {
			case string:
				return v
			case []any:
				var parts []string
				for _, x := range v {
					if s, ok := x.(string); ok {
						parts = append(parts, s)
					}
				}
				return strings.Join(parts, ", ")
			}
			return ""
		}
		m.From = pick(get, "from", "From", "sender")
		m.To = []string{pick(get, "to", "To", "recipient", "OriginalRecipient")}
		m.Subject = pick(get, "subject", "Subject")
		m.Text = pick(get, "text", "TextBody", "StrippedTextReply", "plain")
		htmlBody = pick(get, "html", "HtmlBody")
	} else {
		_ = c.Request.ParseMultipartForm(10 << 20)
		get := c.PostForm
		m.From = pick(get, "from", "sender", "From")
		m.To = []string{pick(get, "recipient", "to", "To")}
		m.Subject = pick(get, "subject", "Subject")
		m.Text = pick(get, "stripped-text", "body-plain", "text")
		htmlBody = pick(get, "body-html", "html")
	}
	if m.Text == "" && htmlBody != "" {
		m.Text = strings.TrimSpace(tagRe.ReplaceAllString(strings.NewReplacer("<br>", "\n", "</p>", "\n\n", "</div>", "\n").Replace(htmlBody), ""))
	}
	return m
}

// inboundEmail is the provider webhook; the secret in the path proves it's them.
func (h *Handler) inboundEmail(c *gin.Context) {
	if h.inboundSecret == "" || subtle.ConstantTimeCompare([]byte(c.Param("secret")), []byte(h.inboundSecret)) != 1 {
		c.Status(http.StatusNotFound)
		return
	}
	t, err := h.svc.ReceiveEmail(c.Request.Context(), h.inboundDomain, parseInbound(c), h.lookup)
	if err != nil {
		response.FromError(c, err)
		return
	}
	// Providers retry on errors, so unknown or refused mail is still a 200.
	response.Data(c, http.StatusOK, gin.H{"created": t != nil})
}

// RegisterInbound mounts the provider webhook.
func (h *Handler) RegisterInbound(rg *gin.RouterGroup, limit gin.HandlerFunc) {
	rg.POST("/inbound/email/:secret", limit, h.inboundEmail)
}
