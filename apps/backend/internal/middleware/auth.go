// Package middleware holds gin middleware for authentication and rate limiting.
package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	gojwt "github.com/golang-jwt/jwt/v5"

	"github.com/indalyadav56/meetspace/backend/pkg/jwt"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// Context keys set by AuthRequired and read by handlers.
const (
	ContextUserID    = "user_id"
	ContextSessionID = "session_id"
)

// AuthRequired validates the Bearer access token and stores the user and
// session ids in the gin context. Requests without a valid token are rejected
// with 401 before reaching the handler.
func AuthRequired(signer *jwt.JWT) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := bearerToken(c.GetHeader("Authorization"))
		if !ok {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "missing or malformed authorization header")
			return
		}

		token, err := signer.ValidateToken(raw)
		if err != nil {
			if errors.Is(err, gojwt.ErrTokenExpired) {
				response.Error(c, http.StatusUnauthorized, "token_expired", "access token has expired")
				return
			}
			response.Error(c, http.StatusUnauthorized, "unauthorized", "invalid access token")
			return
		}

		claims, err := signer.GetClaims(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "invalid access token")
			return
		}

		sub, _ := claims["sub"].(string)
		sid, _ := claims["sid"].(string)
		if sub == "" {
			response.Error(c, http.StatusUnauthorized, "unauthorized", "invalid access token")
			return
		}

		c.Set(ContextUserID, sub)
		c.Set(ContextSessionID, sid)
		c.Next()
	}
}

// bearerToken extracts the token from an "Authorization: Bearer <token>" header.
func bearerToken(header string) (string, bool) {
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	return token, token != ""
}
