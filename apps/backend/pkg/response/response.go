// Package response standardizes JSON API envelopes.
package response

import "github.com/gin-gonic/gin"

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func Data(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{"data": data})
}

func Error(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": errorBody{Code: code, Message: message}})
}
