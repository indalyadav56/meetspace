// Package response standardizes JSON API envelopes.
package response

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ErrorResponse is the envelope returned on errors (used by Swagger annotations).
type ErrorResponse struct {
	Error errorBody `json:"error"`
}

func Data(c *gin.Context, status int, data any) {
	c.JSON(status, gin.H{"data": data})
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func Error(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": errorBody{Code: code, Message: message}})
}

// FromError writes err as an error envelope. Unknown errors become a generic
// 500 so internals never leak; the caller's logger middleware records them.
func FromError(c *gin.Context, err error) {
	var e *apperror.Error
	if !errors.As(err, &e) {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.Code {
			case "22P02": // invalid uuid: a malformed id in the URL is a missing resource, in a body a bad request
				if c.Request.Method == http.MethodPost {
					Error(c, http.StatusBadRequest, "invalid_id", "an id in the request is not a valid uuid")
				} else {
					Error(c, http.StatusNotFound, "not_found", "not found")
				}
				return
			case "23505": // unique violation, e.g. a client-generated id that already exists
				Error(c, http.StatusConflict, "already_exists", "that resource already exists")
				return
			}
		}
		_ = c.Error(err)
		Error(c, http.StatusInternalServerError, "internal", "internal server error")
		return
	}
	status := map[apperror.Kind]int{
		apperror.KindNotFound:     http.StatusNotFound,
		apperror.KindInvalid:      http.StatusBadRequest,
		apperror.KindConflict:     http.StatusConflict,
		apperror.KindUnauthorized: http.StatusUnauthorized,
		apperror.KindForbidden:    http.StatusForbidden,
		apperror.KindUnavailable:  http.StatusServiceUnavailable,
		apperror.KindTooMany:      http.StatusTooManyRequests,
	}[e.Kind]
	if status == 0 {
		_ = c.Error(err)
		status = http.StatusInternalServerError
	}
	Error(c, status, e.Code, e.Message)
}

// BadRequest writes a validation error for a failed bind.
func BadRequest(c *gin.Context, err error) {
	Error(c, http.StatusBadRequest, "invalid_request", err.Error())
}
