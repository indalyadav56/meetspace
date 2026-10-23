// Package v1 exposes integrations (GitHub) over HTTP.
package v1

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/integrations/application"
	"github.com/indalyadav56/meetspace/backend/internal/integrations/infrastructure/github"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct{ svc *application.Service }

func NewHandler(svc *application.Service) *Handler { return &Handler{svc: svc} }

func reply(c *gin.Context, status int, v any, err error) {
	switch {
	case err != nil:
		response.FromError(c, err)
	case status == 0:
		response.NoContent(c)
	default:
		response.Data(c, status, v)
	}
}

type connectReq struct {
	Token string `json:"token" binding:"required"`
}

type reposReq struct {
	Repos []string `json:"repos"`
}

type linkReq struct {
	URL string `json:"url" binding:"required"`
}

func (h *Handler) status(c *gin.Context) {
	v, err := h.svc.Status(c.Request.Context(), authctx.WorkspaceID(c))
	reply(c, http.StatusOK, v, err)
}

func (h *Handler) connect(c *gin.Context) {
	var r connectReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	v, err := h.svc.ConnectGitHub(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r.Token)
	reply(c, http.StatusOK, v, err)
}

func (h *Handler) disconnect(c *gin.Context) {
	reply(c, 0, nil, h.svc.DisconnectGitHub(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c)))
}

func (h *Handler) repos(c *gin.Context) {
	v, err := h.svc.Repos(c.Request.Context(), authctx.WorkspaceID(c))
	reply(c, http.StatusOK, v, err)
}

func (h *Handler) setRepos(c *gin.Context) {
	var r reposReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	v, err := h.svc.SetRepos(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), r.Repos)
	reply(c, http.StatusOK, v, err)
}

func (h *Handler) webhookInfo(c *gin.Context) {
	ws := authctx.WorkspaceID(c)
	secret, err := h.svc.WebhookSecret(c.Request.Context(), ws, authctx.UserID(c))
	reply(c, http.StatusOK, gin.H{"path": "/api/v1/integrations/github/webhook/" + ws, "secret": secret, "contentType": "application/json", "events": []string{"pull_request", "push"}}, err)
}

func (h *Handler) sync(c *gin.Context) {
	n, err := h.svc.Sync(c.Request.Context(), authctx.WorkspaceID(c))
	reply(c, http.StatusOK, gin.H{"linked": n}, err)
}

func (h *Handler) links(c *gin.Context) {
	v, err := h.svc.Links(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id"))
	reply(c, http.StatusOK, v, err)
}

func (h *Handler) link(c *gin.Context) {
	var r linkReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	v, err := h.svc.LinkURL(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), r.URL)
	reply(c, http.StatusCreated, v, err)
}

func (h *Handler) unlink(c *gin.Context) {
	reply(c, 0, nil, h.svc.Unlink(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id")))
}

// Webhook receives GitHub deliveries; it is mounted without auth and checks the HMAC signature.
func (h *Handler) Webhook(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 5<<20))
	if err != nil {
		response.BadRequest(c, err)
		return
	}
	if c.GetHeader("X-GitHub-Event") == "ping" {
		c.Status(http.StatusNoContent)
		return
	}
	n, err := h.svc.HandleWebhook(c.Request.Context(), c.Param("wid"), c.GetHeader("X-Hub-Signature-256"), body, github.ParseWebhook(c.GetHeader("X-GitHub-Event")))
	reply(c, http.StatusOK, gin.H{"linked": n}, err)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.GET("/integrations", h.status)
	rg.POST("/integrations/github", h.connect)
	rg.DELETE("/integrations/github", h.disconnect)
	rg.GET("/integrations/github/repos", h.repos)
	rg.PUT("/integrations/github/repos", h.setRepos)
	rg.GET("/integrations/github/webhook", h.webhookInfo)
	rg.POST("/integrations/github/sync", h.sync)
	rg.GET("/tasks/:id/github", h.links)
	rg.POST("/tasks/:id/github", h.link)
	rg.DELETE("/github-links/:id", h.unlink)
}
