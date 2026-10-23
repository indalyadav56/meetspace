// Package v1 exposes clips over HTTP.
package v1

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/indalyadav56/meetspace/backend/internal/media/application"
	"github.com/indalyadav56/meetspace/backend/internal/media/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/authctx"
	"github.com/indalyadav56/meetspace/backend/pkg/response"
)

type Handler struct {
	svc     *application.Service
	maxSize int64
}

func NewHandler(svc *application.Service, maxSize int64) *Handler {
	return &Handler{svc: svc, maxSize: maxSize}
}

type patchReq struct {
	Title  *string `json:"title"`
	TaskID *string `json:"taskId"`
}

type shareReq struct {
	ChannelID string `json:"channelId" binding:"required"`
}

// upload expects multipart/form-data with a "file" part plus metadata fields.
func (h *Handler) upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.maxSize+1<<20)
	file, hdr, err := c.Request.FormFile("file")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "missing_file", "attach the recording as the \"file\" field")
		return
	}
	defer file.Close()
	dur, _ := strconv.Atoi(c.PostForm("durationSec"))
	var task *string
	if t := c.PostForm("taskId"); t != "" {
		task = &t
	}
	mime := hdr.Header.Get("Content-Type")
	if m := c.PostForm("mime"); m != "" {
		mime = m
	}
	clip, err := h.svc.Upload(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), application.UploadInput{
		Title: c.PostForm("title"), Kind: c.PostForm("kind"), Mime: mime, DurationSec: dur, TaskID: task,
		Transcript: c.PostForm("transcript"), Thumb: c.PostForm("thumb"),
	}, file)
	if err != nil {
		response.FromError(c, err)
		return
	}
	response.Data(c, http.StatusCreated, clip)
}

// media streams the file with Range support so players can seek.
func (h *Handler) media(c *gin.Context) {
	clip, f, err := h.svc.Open(c.Request.Context(), authctx.WorkspaceID(c), c.Param("id"))
	if err != nil {
		response.FromError(c, err)
		return
	}
	defer f.Close()
	c.Header("Content-Type", clip.Mime)
	c.Header("Cache-Control", "private, max-age=3600")
	http.ServeContent(c.Writer, c.Request, "", clip.CreatedAt, f)
}

func (h *Handler) patch(c *gin.Context) {
	var r patchReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	ws, id := authctx.WorkspaceID(c), c.Param("id")
	var clip *domain.Clip
	var err error
	if r.Title != nil {
		if clip, err = h.svc.Rename(c.Request.Context(), ws, id, *r.Title); err != nil {
			response.FromError(c, err)
			return
		}
	}
	if r.TaskID != nil {
		if clip, err = h.svc.AttachToTask(c.Request.Context(), ws, id, *r.TaskID); err != nil {
			response.FromError(c, err)
			return
		}
	}
	response.Data(c, http.StatusOK, clip)
}

func (h *Handler) share(c *gin.Context) {
	var r shareReq
	if err := c.ShouldBindJSON(&r); err != nil {
		response.BadRequest(c, err)
		return
	}
	if err := h.svc.Share(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id"), r.ChannelID); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

func (h *Handler) delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), authctx.WorkspaceID(c), authctx.UserID(c), c.Param("id")); err != nil {
		response.FromError(c, err)
		return
	}
	response.NoContent(c)
}

// Register mounts routes on /workspaces/:wid.
func (h *Handler) Register(rg *gin.RouterGroup) {
	rg.POST("/clips", h.upload)
	rg.GET("/clips/:id/media", h.media)
	rg.PATCH("/clips/:id", h.patch)
	rg.POST("/clips/:id/share", h.share)
	rg.DELETE("/clips/:id", h.delete)
}
