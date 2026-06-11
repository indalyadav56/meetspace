package v1

import "github.com/gin-gonic/gin"

func RegisterRoutes(g *gin.RouterGroup, h *Handler) {
	meetings := g.Group("/meetings")
	{
		meetings.GET("", h.List)
		meetings.POST("", h.Create)
		meetings.GET("/:meetingID", h.Get)
	}
}
