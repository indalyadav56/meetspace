package v1

import "github.com/gin-gonic/gin"

// RegisterRoutes mounts workspace routes on the given group. The context
// knows only its resource paths — versioning belongs to the composition root.
func RegisterRoutes(g *gin.RouterGroup, h *Handler) {
	users := g.Group("/users")
	{
		users.GET("", h.ListUsers)
		users.POST("", h.CreateUser)
		users.GET("/:userID", h.GetUser)
	}

	teams := g.Group("/teams")
	{
		teams.GET("", h.ListTeams)
		teams.POST("", h.CreateTeam)
		teams.GET("/:teamID", h.GetTeam)
	}
}
