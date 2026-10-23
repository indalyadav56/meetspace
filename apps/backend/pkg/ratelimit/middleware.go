package ratelimit

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Middleware limits requests per client IP and answers 429 when exceeded.
func (l *Limiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !l.Allow(c.ClientIP() + "|" + c.FullPath()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": gin.H{"code": "rate_limited", "message": "too many requests, try again later"}})
			return
		}
		c.Next()
	}
}
