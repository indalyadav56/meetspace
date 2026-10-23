// Package middleware holds HTTP middleware that depends on identity rules.
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// TokenValidator validates an access token and returns its claims.
type TokenValidator interface {
	Claims(token string) (map[string]any, error)
}

// BearerToken extracts the access token from the Authorization header, or from
// the access_token query parameter for transports that can't set headers
// (browser WebSockets, <video src> for media).
func BearerToken(c *gin.Context) string {
	if h := c.GetHeader("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
	}
	return c.Query("access_token")
}

// AuthRequired rejects requests without a valid access token and stores the
// user and session ids on the context.
func AuthRequired(v TokenValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		tok := BearerToken(c)
		if tok == "" {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing access token")
			return
		}
		claims, err := v.Claims(tok)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "invalid or expired access token")
			return
		}
		sub, _ := claims["sub"].(string)
		sid, _ := claims["sid"].(string)
		if sub == "" {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "invalid access token")
			return
		}
		authctx.SetUser(c, sub, sid)
		c.Next()
	}
}
