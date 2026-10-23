// Package v1 exposes the work context over HTTP.
package v1

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/work/application"
	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	svc      *application.Service
	mentions application.MentionResolver
}

func NewHandler(svc *application.Service, mentions application.MentionResolver) *Handler {
	return &Handler{svc: svc, mentions: mentions}
}

func ws(c *gin.Context) string    { return authctx.WorkspaceID(c) }
func actor(c *gin.Context) string { return authctx.UserID(c) }

// respond writes v (or an error) with the given success status.
func respond(c *gin.Context, status int, v any, err error) {
	if err != nil {
		response.FromError(c, err)
		return
	}
	if v == nil {
		response.NoContent(c)
		return
	}
	response.Data(c, status, v)
}

func bind[T any](c *gin.Context) (T, bool) {
	var v T
	if err := c.ShouldBindJSON(&v); err != nil {
		response.BadRequest(c, err)
		return v, false
	}
	return v, true
}

// ---- projects, folders, lists

type nameColorReq struct {
	ID    string `json:"id"`
	Name  string `json:"name" binding:"required"`
	Color string `json:"color"`
}

type projectPatchReq struct {
	Name     *string          `json:"name"`
	Color    *string          `json:"color"`
	Statuses *[]domain.Status `json:"statuses"`
}

type folderReq struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId" binding:"required"`
	Name      string `json:"name" binding:"required"`
}

type listReq struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"projectId" binding:"required"`
	FolderID  *string `json:"folderId"`
	Name      string  `json:"name" binding:"required"`
}

type renameReq struct {
	Name string `json:"name" binding:"required"`
}

type templateReq struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId" binding:"required"`
	Template  string `json:"template" binding:"required"`
	Name      string `json:"name"`
}

func (h *Handler) createProject(c *gin.Context) {
	if r, ok := bind[nameColorReq](c); ok {
		p, err := h.svc.CreateProject(c.Request.Context(), ws(c), r.ID, r.Name, r.Color)
		respond(c, http.StatusCreated, p, err)
	}
}

func (h *Handler) updateProject(c *gin.Context) {
	if r, ok := bind[projectPatchReq](c); ok {
		p, err := h.svc.UpdateProject(c.Request.Context(), ws(c), c.Param("id"), application.ProjectPatch{Name: r.Name, Color: r.Color, Statuses: r.Statuses})
		respond(c, http.StatusOK, p, err)
	}
}

func (h *Handler) deleteProject(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteProject(c.Request.Context(), ws(c), c.Param("id")))
}

func (h *Handler) createFolder(c *gin.Context) {
	if r, ok := bind[folderReq](c); ok {
		f, err := h.svc.CreateFolder(c.Request.Context(), ws(c), r.ID, r.ProjectID, r.Name)
		respond(c, http.StatusCreated, f, err)
	}
}

func (h *Handler) renameFolder(c *gin.Context) {
	if r, ok := bind[renameReq](c); ok {
		f, err := h.svc.RenameFolder(c.Request.Context(), ws(c), c.Param("id"), r.Name)
		respond(c, http.StatusOK, f, err)
	}
}

func (h *Handler) deleteFolder(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteFolder(c.Request.Context(), ws(c), c.Param("id")))
}

func (h *Handler) createList(c *gin.Context) {
	if r, ok := bind[listReq](c); ok {
		l, err := h.svc.CreateList(c.Request.Context(), ws(c), r.ID, r.ProjectID, r.FolderID, r.Name)
		respond(c, http.StatusCreated, l, err)
	}
}

func (h *Handler) renameList(c *gin.Context) {
	if r, ok := bind[renameReq](c); ok {
		l, err := h.svc.RenameList(c.Request.Context(), ws(c), c.Param("id"), r.Name)
		respond(c, http.StatusOK, l, err)
	}
}

func (h *Handler) deleteList(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteList(c.Request.Context(), ws(c), c.Param("id")))
}

func (h *Handler) listFromTemplate(c *gin.Context) {
	if r, ok := bind[templateReq](c); ok {
		l, err := h.svc.ApplyTemplate(c.Request.Context(), ws(c), actor(c), r.ID, r.ProjectID, r.Template, r.Name)
		respond(c, http.StatusCreated, l, err)
	}
}

// ---- tasks

type moveReq struct {
	StatusID string  `json:"statusId" binding:"required"`
	BeforeID *string `json:"beforeId"`
}

type bulkReq struct {
	IDs         []string              `json:"ids" binding:"required,min=1,max=500"`
	Patch       application.TaskPatch `json:"patch"`
	AddAssignee string                `json:"addAssignee"`
}

type idsReq struct {
	IDs []string `json:"ids" binding:"required,min=1,max=500"`
}

type depReq struct {
	BlockerID string `json:"blockerId" binding:"required"`
}

type importReq struct {
	ListID string                  `json:"listId" binding:"required"`
	Rows   []application.TaskInput `json:"rows" binding:"required,max=2000"`
}

func (h *Handler) createTask(c *gin.Context) {
	if r, ok := bind[application.TaskInput](c); ok {
		t, err := h.svc.CreateTask(c.Request.Context(), ws(c), actor(c), r)
		respond(c, http.StatusCreated, t, err)
	}
}

func (h *Handler) getTask(c *gin.Context) {
	t, err := h.svc.GetTask(c.Request.Context(), ws(c), c.Param("id"))
	respond(c, http.StatusOK, t, err)
}

func (h *Handler) updateTask(c *gin.Context) {
	if r, ok := bind[application.TaskPatch](c); ok {
		t, err := h.svc.UpdateTask(c.Request.Context(), ws(c), actor(c), c.Param("id"), r)
		respond(c, http.StatusOK, t, err)
	}
}

func (h *Handler) deleteTask(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteTask(c.Request.Context(), ws(c), c.Param("id")))
}

func (h *Handler) duplicateTask(c *gin.Context) {
	var r struct {
		ID string `json:"id"` // optional id for the copy
	}
	_ = c.ShouldBindJSON(&r)
	t, err := h.svc.DuplicateTask(c.Request.Context(), ws(c), actor(c), c.Param("id"), r.ID)
	respond(c, http.StatusCreated, t, err)
}

func (h *Handler) moveTask(c *gin.Context) {
	if r, ok := bind[moveReq](c); ok {
		t, err := h.svc.MoveTask(c.Request.Context(), ws(c), actor(c), c.Param("id"), r.StatusID, r.BeforeID)
		respond(c, http.StatusOK, t, err)
	}
}

func (h *Handler) bulkUpdate(c *gin.Context) {
	if r, ok := bind[bulkReq](c); ok {
		ts, err := h.svc.BulkUpdate(c.Request.Context(), ws(c), actor(c), r.IDs, r.Patch, r.AddAssignee)
		respond(c, http.StatusOK, ts, err)
	}
}

func (h *Handler) bulkDelete(c *gin.Context) {
	if r, ok := bind[idsReq](c); ok {
		respond(c, 0, nil, h.svc.BulkDelete(c.Request.Context(), ws(c), r.IDs))
	}
}

func (h *Handler) addDependency(c *gin.Context) {
	if r, ok := bind[depReq](c); ok {
		t, err := h.svc.AddDependency(c.Request.Context(), ws(c), actor(c), c.Param("id"), r.BlockerID)
		respond(c, http.StatusOK, t, err)
	}
}

func (h *Handler) removeDependency(c *gin.Context) {
	t, err := h.svc.RemoveDependency(c.Request.Context(), ws(c), c.Param("id"), c.Param("blockerId"))
	respond(c, http.StatusOK, t, err)
}

func (h *Handler) importTasks(c *gin.Context) {
	if r, ok := bind[importReq](c); ok {
		n, err := h.svc.ImportTasks(c.Request.Context(), ws(c), actor(c), r.ListID, r.Rows)
		respond(c, http.StatusCreated, gin.H{"imported": n}, err)
	}
}

// ---- comments

type commentReq struct {
	Text     string  `json:"text" binding:"required"`
	Assignee *string `json:"assignee"`
}

type resolveReq struct {
	Resolved bool `json:"resolved"`
}

func (h *Handler) addComment(c *gin.Context) {
	if r, ok := bind[commentReq](c); ok {
		if r.Assignee != nil && *r.Assignee == "" {
			r.Assignee = nil
		}
		cm, err := h.svc.AddComment(c.Request.Context(), ws(c), actor(c), c.Param("id"), r.Text, r.Assignee, h.mentions)
		respond(c, http.StatusCreated, cm, err)
	}
}

func (h *Handler) resolveComment(c *gin.Context) {
	if r, ok := bind[resolveReq](c); ok {
		cm, err := h.svc.SetCommentResolved(c.Request.Context(), ws(c), c.Param("id"), r.Resolved)
		respond(c, http.StatusOK, cm, err)
	}
}

// ---- custom fields

type fieldReq struct {
	ID     string `json:"id"`
	ListID string `json:"listId" binding:"required"`
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
}

type fieldPatchReq struct {
	Name    *string               `json:"name"`
	Options *[]domain.FieldOption `json:"options"`
}

func (h *Handler) createField(c *gin.Context) {
	if r, ok := bind[fieldReq](c); ok {
		f, err := h.svc.CreateField(c.Request.Context(), ws(c), r.ID, r.ListID, r.Name, r.Type)
		respond(c, http.StatusCreated, f, err)
	}
}

func (h *Handler) updateField(c *gin.Context) {
	if r, ok := bind[fieldPatchReq](c); ok {
		f, err := h.svc.UpdateField(c.Request.Context(), ws(c), c.Param("id"), r.Name, r.Options)
		respond(c, http.StatusOK, f, err)
	}
}

func (h *Handler) deleteField(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteField(c.Request.Context(), ws(c), c.Param("id")))
}

// ---- time

type timerReq struct {
	TaskID string `json:"taskId" binding:"required"`
}

type entryReq struct {
	TaskID   string    `json:"taskId" binding:"required"`
	Start    time.Time `json:"start" binding:"required"`
	Duration int       `json:"duration" binding:"required"`
	Note     string    `json:"note"`
}

type entryPatchReq struct {
	Duration *int    `json:"duration"`
	Note     *string `json:"note"`
}

func (h *Handler) startTimer(c *gin.Context) {
	if r, ok := bind[timerReq](c); ok {
		t, err := h.svc.StartTimer(c.Request.Context(), ws(c), actor(c), r.TaskID)
		respond(c, http.StatusOK, t, err)
	}
}

func (h *Handler) stopTimer(c *gin.Context) {
	e, err := h.svc.StopTimer(c.Request.Context(), ws(c), actor(c))
	respond(c, http.StatusOK, e, err)
}

func (h *Handler) addEntry(c *gin.Context) {
	if r, ok := bind[entryReq](c); ok {
		e, err := h.svc.AddTimeEntry(c.Request.Context(), ws(c), actor(c), r.TaskID, r.Start, r.Duration, r.Note)
		respond(c, http.StatusCreated, e, err)
	}
}

func (h *Handler) updateEntry(c *gin.Context) {
	if r, ok := bind[entryPatchReq](c); ok {
		e, err := h.svc.UpdateTimeEntry(c.Request.Context(), ws(c), actor(c), c.Param("id"), r.Duration, r.Note)
		respond(c, http.StatusOK, e, err)
	}
}

func (h *Handler) deleteEntry(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteTimeEntry(c.Request.Context(), ws(c), actor(c), c.Param("id")))
}

// ---- sprints

type sprintReq struct {
	ID        string `json:"id"`
	ProjectID string `json:"projectId" binding:"required"`
}

type completeReq struct {
	MoveTo *string `json:"moveTo"`
}

func (h *Handler) createSprint(c *gin.Context) {
	if r, ok := bind[sprintReq](c); ok {
		s, err := h.svc.CreateSprint(c.Request.Context(), ws(c), r.ID, r.ProjectID)
		respond(c, http.StatusCreated, s, err)
	}
}

func (h *Handler) updateSprint(c *gin.Context) {
	if r, ok := bind[application.SprintPatch](c); ok {
		s, err := h.svc.UpdateSprint(c.Request.Context(), ws(c), c.Param("id"), r)
		respond(c, http.StatusOK, s, err)
	}
}

func (h *Handler) deleteSprint(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteSprint(c.Request.Context(), ws(c), c.Param("id")))
}

func (h *Handler) startSprint(c *gin.Context) {
	s, err := h.svc.StartSprint(c.Request.Context(), ws(c), c.Param("id"))
	respond(c, http.StatusOK, s, err)
}

func (h *Handler) completeSprint(c *gin.Context) {
	if r, ok := bind[completeReq](c); ok {
		s, err := h.svc.CompleteSprint(c.Request.Context(), ws(c), actor(c), c.Param("id"), r.MoveTo)
		respond(c, http.StatusOK, s, err)
	}
}

// ---- automations

func (h *Handler) createAutomation(c *gin.Context) {
	if r, ok := bind[domain.Automation](c); ok {
		a, err := h.svc.CreateAutomation(c.Request.Context(), ws(c), r)
		respond(c, http.StatusCreated, a, err)
	}
}

func (h *Handler) updateAutomation(c *gin.Context) {
	if r, ok := bind[application.AutomationPatch](c); ok {
		a, err := h.svc.UpdateAutomation(c.Request.Context(), ws(c), c.Param("id"), r)
		respond(c, http.StatusOK, a, err)
	}
}

func (h *Handler) deleteAutomation(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteAutomation(c.Request.Context(), ws(c), c.Param("id")))
}

// ---- forms

type formReq struct {
	ID     string `json:"id"`
	ListID string `json:"listId" binding:"required"`
}

type submitReq struct {
	Values map[string]string `json:"values" binding:"required"`
}

func (h *Handler) createForm(c *gin.Context) {
	if r, ok := bind[formReq](c); ok {
		f, err := h.svc.CreateForm(c.Request.Context(), ws(c), actor(c), r.ID, r.ListID)
		respond(c, http.StatusCreated, f, err)
	}
}

func (h *Handler) updateForm(c *gin.Context) {
	if r, ok := bind[application.FormPatch](c); ok {
		f, err := h.svc.UpdateForm(c.Request.Context(), ws(c), c.Param("id"), r)
		respond(c, http.StatusOK, f, err)
	}
}

func (h *Handler) deleteForm(c *gin.Context) {
	respond(c, 0, nil, h.svc.DeleteForm(c.Request.Context(), ws(c), c.Param("id")))
}

func (h *Handler) publicForm(c *gin.Context) {
	f, err := h.svc.GetPublicForm(c.Request.Context(), c.Param("id"))
	respond(c, http.StatusOK, f, err)
}

func (h *Handler) submitForm(c *gin.Context) {
	if r, ok := bind[submitReq](c); ok {
		_, err := h.svc.SubmitForm(c.Request.Context(), c.Param("id"), r.Values)
		respond(c, http.StatusCreated, gin.H{"submitted": true}, err)
	}
}

// Register mounts authenticated routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/projects", h.createProject)
	rg.PATCH("/projects/:id", h.updateProject)
	rg.DELETE("/projects/:id", h.deleteProject)

	rg.POST("/folders", h.createFolder)
	rg.PATCH("/folders/:id", h.renameFolder)
	rg.DELETE("/folders/:id", h.deleteFolder)

	rg.POST("/lists", h.createList)
	rg.POST("/lists/from-template", h.listFromTemplate)
	rg.PATCH("/lists/:id", h.renameList)
	rg.DELETE("/lists/:id", h.deleteList)

	rg.POST("/tasks", h.createTask)
	rg.POST("/tasks/bulk", h.bulkUpdate)
	rg.POST("/tasks/bulk-delete", h.bulkDelete)
	rg.POST("/tasks/import", h.importTasks)
	rg.GET("/tasks/:id", h.getTask)
	rg.PATCH("/tasks/:id", h.updateTask)
	rg.DELETE("/tasks/:id", h.deleteTask)
	rg.POST("/tasks/:id/duplicate", h.duplicateTask)
	rg.POST("/tasks/:id/move", h.moveTask)
	rg.POST("/tasks/:id/dependencies", h.addDependency)
	rg.DELETE("/tasks/:id/dependencies/:blockerId", h.removeDependency)
	rg.POST("/tasks/:id/comments", h.addComment)
	rg.PATCH("/comments/:id", h.resolveComment)

	rg.POST("/fields", h.createField)
	rg.PATCH("/fields/:id", h.updateField)
	rg.DELETE("/fields/:id", h.deleteField)

	rg.POST("/timer/start", h.startTimer)
	rg.POST("/timer/stop", h.stopTimer)
	rg.POST("/time-entries", h.addEntry)
	rg.PATCH("/time-entries/:id", h.updateEntry)
	rg.DELETE("/time-entries/:id", h.deleteEntry)

	rg.POST("/sprints", h.createSprint)
	rg.PATCH("/sprints/:id", h.updateSprint)
	rg.DELETE("/sprints/:id", h.deleteSprint)
	rg.POST("/sprints/:id/start", h.startSprint)
	rg.POST("/sprints/:id/complete", h.completeSprint)

	rg.POST("/automations", h.createAutomation)
	rg.PATCH("/automations/:id", h.updateAutomation)
	rg.DELETE("/automations/:id", h.deleteAutomation)

	rg.POST("/forms", h.createForm)
	rg.PATCH("/forms/:id", h.updateForm)
	rg.DELETE("/forms/:id", h.deleteForm)
}

// RegisterPublic mounts the unauthenticated form endpoints (rg = /public).
func (h *Handler) RegisterPublic(rg *gin.RouterGroup, submitLimit gin.HandlerFunc) {
	rg.GET("/forms/:id", h.publicForm)
	rg.POST("/forms/:id/submit", submitLimit, h.submitForm)
}
