// Package v1 exposes data-protection requests over HTTP.
package v1

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/privacy/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

// SecurityLog records the request in the audit trail.
type SecurityLog interface {
	Security(userID, action, ip, ua string, meta map[string]any)
}

type Handler struct {
	svc *application.Service
	log SecurityLog
}

func NewHandler(svc *application.Service, log SecurityLog) *Handler {
	return &Handler{svc: svc, log: log}
}

// Register mounts /users/me/data routes (rg must already require auth).
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/me/data/export", h.export)
	rg.POST("/me/delete", h.deleteAccount)
}

// RegisterPublic mounts the grievance contact, shown on the Privacy Policy.
func (h *Handler) RegisterPublic(rg *gin.RouterGroup) {
	rg.GET("/privacy/contact", func(c *gin.Context) { response.Data(c, http.StatusOK, h.svc.Contact()) })
}

func (h *Handler) export(c *gin.Context) {
	user := authctx.UserID(c)
	data, err := h.svc.Export(c.Request.Context(), user)
	if err != nil {
		response.FromError(c, err)
		return
	}
	body, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		response.FromError(c, err)
		return
	}
	h.log.Security(user, "privacy.exported", c.ClientIP(), c.Request.UserAgent(), nil)
	c.Header("Cache-Control", "no-store")
	c.Header("Content-Disposition", `attachment; filename="meetspace-data-`+time.Now().UTC().Format("2006-01-02")+`.json"`)
	c.Data(http.StatusOK, "application/json", body)
}

type deleteReq struct {
	Password string `json:"password"`
	Email    string `json:"email"`
}

func (h *Handler) deleteAccount(c *gin.Context) {
	var req deleteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err)
		return
	}
	user := authctx.UserID(c)
	if err := h.svc.Delete(c.Request.Context(), user, req.Password, req.Email); err != nil {
		response.FromError(c, err)
		return
	}
	// The audit row keeps no name or email once the account is anonymised.
	h.log.Security(user, "privacy.account_deleted", c.ClientIP(), c.Request.UserAgent(), nil)
	response.NoContent(c)
}
