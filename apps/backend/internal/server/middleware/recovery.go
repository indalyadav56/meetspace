package middleware

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Recovery(log *slog.Logger) gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, err any) {
		log.Error("panic recovered", "error", err, "path", c.Request.URL.Path)
		c.AbortWithStatusJSON(http.StatusInternalServerError,
			gin.H{"error": gin.H{"code": "internal", "message": "internal server error"}})
	})
}
