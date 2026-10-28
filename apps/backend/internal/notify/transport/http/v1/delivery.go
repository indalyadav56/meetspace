package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/notify/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

func (h *Handler) preferences(c *gin.Context) {
	p, err := h.delivery.Preferences(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, p)
}

func (h *Handler) savePreferences(c *gin.Context) {
	var p domain.Preferences
	if err := c.ShouldBindJSON(&p); err != nil {
		response.BadRequest(c, err)
		return
	}
	saved, err := h.delivery.SavePreferences(c.Request.Context(), authctx.UserID(c), p)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, saved)
}

func (h *Handler) pushKey(c *gin.Context) {
	k, err := h.delivery.PublicKey(c.Request.Context())
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, gin.H{"publicKey": k})
}

type subscribeReq struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func (h *Handler) subscribe(c *gin.Context) {
	var r subscribeReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	err := h.delivery.Subscribe(c.Request.Context(), domain.PushSubscription{UserID: authctx.UserID(c), Endpoint: r.Endpoint, P256dh: r.Keys.P256dh, Auth: r.Keys.Auth, UserAgent: c.Request.UserAgent()})
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) unsubscribe(c *gin.Context) {
	var r struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	if err := h.delivery.Unsubscribe(c.Request.Context(), authctx.UserID(c), r.Endpoint); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) subscriptions(c *gin.Context) {
	list, err := h.delivery.Subscriptions(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, list)
}

func (h *Handler) testPush(c *gin.Context) {
	n, err := h.delivery.Test(c.Request.Context(), authctx.UserID(c))
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusOK, gin.H{"sent": n})
}

// RegisterUser mounts the caller's delivery settings on /users.
func (h *Handler) RegisterUser(rg *gin.RouterGroup) {
	if h.delivery == nil {
		return
	}
	rg.GET("/me/notifications/preferences", h.preferences)
	rg.PUT("/me/notifications/preferences", h.savePreferences)
	rg.GET("/me/notifications/push-key", h.pushKey)
	rg.GET("/me/notifications/push-subscriptions", h.subscriptions)
	rg.POST("/me/notifications/push-subscriptions", h.subscribe)
	rg.POST("/me/notifications/push-subscriptions/remove", h.unsubscribe)
	rg.POST("/me/notifications/test", h.testPush)
}
