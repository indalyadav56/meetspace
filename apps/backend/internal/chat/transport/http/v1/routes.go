package v1

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts chat routes. Channels nest under /teams/:teamID —
// the same prefix the workspace context uses; Gin merges both route sets,
// and the shared :teamID param name keeps them compatible.
func RegisterRoutes(g *gin.RouterGroup, h *Handler) {
	channels := g.Group("/teams/:teamID/channels")
	{
		channels.GET("", h.ListChannels)
		channels.POST("", h.CreateChannel)
	}

	conversations := g.Group("/conversations/:conversationID/messages")
	{
		conversations.GET("", h.ListMessages)
		conversations.POST("", h.SendMessage)
	}
}
