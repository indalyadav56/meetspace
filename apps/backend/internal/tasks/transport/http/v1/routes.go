package v1

import "github.com/gin-gonic/gin"

func RegisterRoutes(g *gin.RouterGroup, h *Handler) {
	tasks := g.Group("/tasks")
	{
		tasks.GET("", h.List)
		tasks.POST("", h.Create)
		tasks.GET("/:taskID", h.Get)
		tasks.PATCH("/:taskID", h.Update)
		tasks.DELETE("/:taskID", h.Delete)
		tasks.POST("/:taskID/move", h.Move)
		tasks.POST("/:taskID/subtasks", h.AddSubtask)
		tasks.POST("/:taskID/subtasks/:subtaskID/toggle", h.ToggleSubtask)
		tasks.POST("/:taskID/comments", h.AddComment)
	}
}
