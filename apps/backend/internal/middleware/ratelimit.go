package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/pkg/ratelimit"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// RateLimit rejects requests once a client IP exceeds the limiter's window. A
// nil limiter disables rate limiting (the middleware passes every request).
func RateLimit(l *ratelimit.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if l != nil && !l.Allow(c.ClientIP()) {
			response.Error(c, http.StatusTooManyRequests, "rate_limited", "too many requests, please slow down")
			return
		}
		c.Next()
	}
}
