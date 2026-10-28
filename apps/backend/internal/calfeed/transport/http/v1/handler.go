// Package v1 exposes calendar feeds over HTTP.
package v1

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/calfeed/application"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	svc    *application.Service
	webURL string
}

func NewHandler(svc *application.Service, webURL string) *Handler {
	return &Handler{svc: svc, webURL: strings.TrimRight(webURL, "/")}
}

func (h *Handler) url(tok string) gin.H {
	https := h.webURL + "/api/v1/public/calendar/" + tok + ".ics"
	return gin.H{"url": https, "webcal": "webcal://" + strings.TrimPrefix(strings.TrimPrefix(https, "https://"), "http://")}
}

func (h *Handler) get(c *gin.Context) {
	tok, err := h.svc.Current(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, h.url(tok))
}

func (h *Handler) enable(c *gin.Context) {
	tok, err := h.svc.Enable(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Query("rotate") == "1")
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, h.url(tok))
}

func (h *Handler) disable(c *gin.Context) {
	if err := h.svc.Disable(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c)); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) feed(c *gin.Context) {
	tok := strings.TrimSuffix(c.Param("token"), ".ics")
	body, err := h.svc.Feed(c.Request.Context(), tok)
	if err != nil {
		c.String(http.StatusNotFound, "calendar feed not found")
		return
	}
	c.Header("Cache-Control", "private, max-age=300")
	c.Data(http.StatusOK, "text/calendar; charset=utf-8", []byte(body))
}

// Register mounts the caller's feed settings on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/calendar-feed", h.get)
	rg.POST("/calendar-feed", h.enable)
	rg.DELETE("/calendar-feed", h.disable)
}

// RegisterPublic mounts the subscription URL calendar apps fetch.
func (h *Handler) RegisterPublic(rg *gin.RouterGroup, limit gin.HandlerFunc) {
	rg.GET("/calendar/:token", limit, h.feed)
}
