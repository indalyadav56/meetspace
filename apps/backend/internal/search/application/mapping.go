package application

import (
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strings"
	"time"

	"github.com/indalyadav56/meetspace/backend/internal/search/domain"
)

// Change is one record from another context: a realtime event or a row from a
// reindex. Payload is the item's JSON as the API returns it.
type Change struct {
	WorkspaceID string
	Collection  string
	Op          string
	Payload     json.RawMessage
	Audience    []string
}

// collectionTypes maps realtime collections to document types.
var collectionTypes = map[string]string{
	"tasks": "task", "docs": "doc", "messages": "message", "comments": "comment", "clips": "clip",
	"goals": "goal", "whiteboards": "whiteboard", "forms": "form", "lists": "list", "folders": "folder",
	"projects": "project", "meetings": "meeting", "channels": "channel",
}

// Indexed reports whether a collection is searchable.
func Indexed(collection string) bool { _, ok := collectionTypes[collection]; return ok }

type item map[string]any

func (it item) str(k string) string {
	switch v := it[k].(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%.0f", v)
	}
	return ""
}

func (it item) time(keys ...string) time.Time {
	for _, k := range keys {
		if t, err := time.Parse(time.RFC3339Nano, it.str(k)); err == nil {
			return t
		}
	}
	return time.Now().UTC()
}

var (
	tagRe    = regexp.MustCompile(`<[^>]+>`)
	spacesRe = regexp.MustCompile(`[ \t]+`)
)

// plain turns rich-text HTML into searchable text.
func plain(s string) string {
	s = strings.NewReplacer("</p>", "\n", "</li>", "\n", "<br>", "\n", "</h1>", "\n", "</h2>", "\n", "</h3>", "\n").Replace(s)
	return strings.TrimSpace(spacesRe.ReplaceAllString(html.UnescapeString(tagRe.ReplaceAllString(s, " ")), " "))
}

// toDocument maps an upserted item to a search document; ok is false for items that aren't searchable.
func toDocument(c Change) (domain.Document, bool) {
	typ, ok := collectionTypes[c.Collection]
	if !ok {
		return domain.Document{}, false
	}
	var it item
	if err := json.Unmarshal(c.Payload, &it); err != nil || it.str("id") == "" {
		return domain.Document{}, false
	}
	d := domain.Document{WorkspaceID: c.WorkspaceID, Type: typ, EntityID: it.str("id"), Audience: c.Audience}
	// Messages and comments carry the writer as userId; everything else as createdBy.
	d.Author = it.str("createdBy")
	if d.Author == "" {
		d.Author = it.str("userId")
	}
	switch typ {
	case "task":
		d.Title, d.Body, d.Parent = it.str("title"), plain(it.str("description")), it.str("listId")
		d.Key = "MS-" + it.str("key")
		if tags, ok := it["tags"].([]any); ok {
			for _, t := range tags {
				if s, ok := t.(string); ok {
					d.Body += " #" + s
				}
			}
		}
		d.UpdatedAt = it.time("updatedAt", "createdAt")
	case "doc":
		d.Title, d.Body, d.Parent = it.str("title"), plain(it.str("content")), it.str("projectId")
		if d.Title == "" {
			d.Title = "Untitled"
		}
		d.UpdatedAt = it.time("updatedAt")
	case "message":
		d.Body, d.Parent = it.str("text"), it.str("channelId")
		d.Title = firstLine(d.Body)
		d.UpdatedAt = it.time("createdAt")
	case "comment":
		d.Body, d.Parent = it.str("text"), it.str("taskId")
		d.Title = firstLine(d.Body)
		d.UpdatedAt = it.time("createdAt")
	case "clip":
		d.Title, d.Body, d.Parent = it.str("title"), it.str("transcript"), it.str("taskId")
		d.UpdatedAt = it.time("createdAt")
	case "goal":
		d.Title, d.Body = it.str("name"), it.str("description")
		d.UpdatedAt = it.time("createdAt")
	case "whiteboard":
		d.Title = it.str("title")
		if items, ok := it["items"].([]any); ok {
			var notes []string
			for _, x := range items {
				if m, ok := x.(map[string]any); ok {
					if t, _ := m["text"].(string); t != "" {
						notes = append(notes, t)
					}
				}
			}
			d.Body = strings.Join(notes, "\n")
		}
		d.UpdatedAt = it.time("updatedAt")
	case "form":
		d.Title, d.Body, d.Parent = it.str("title"), it.str("description"), it.str("listId")
		d.UpdatedAt = it.time("createdAt")
	case "list", "folder":
		d.Title, d.Parent = it.str("name"), it.str("projectId")
	case "project":
		d.Title = it.str("name")
		d.UpdatedAt = it.time("createdAt")
	case "meeting":
		d.Title, d.Body = it.str("title"), it.str("agenda")
		d.UpdatedAt = it.time("start")
	case "channel":
		if it.str("kind") == "dm" {
			return domain.Document{}, false // DMs are found through their messages
		}
		d.Title, d.Body = "#"+it.str("name"), it.str("topic")
		d.UpdatedAt = it.time("createdAt")
	}
	if d.UpdatedAt.IsZero() {
		d.UpdatedAt = time.Now().UTC()
	}
	if strings.TrimSpace(d.Title+d.Body) == "" {
		return domain.Document{}, false
	}
	d.Public = len(d.Audience) == 0
	if d.Audience == nil {
		d.Audience = []string{}
	}
	return d, true
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	if r := []rune(s); len(r) > 90 {
		s = string(r[:90]) + "…"
	}
	return s
}
