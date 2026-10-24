package application

import (
	"context"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
	"github.com/indalyadav56/meetspace/backend/pkg/optional"
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

var projectColors = []string{"#4f46e5", "#14b8a6", "#f43f5e", "#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981", "#ec4899"}

// Bootstrap gives a brand-new workspace a "General" project with a "Tasks" list.
// It satisfies the workspace context's Bootstrapper port.
func (s *Service) Bootstrap(ctx context.Context, ws, _ string) error {
	p, err := s.CreateProject(ctx, ws, "", "General", "")
	if err != nil {
		return err
	}
	_, err = s.CreateList(ctx, ws, "", p.ID, nil, "Tasks")
	return err
}

func (s *Service) CreateProject(ctx context.Context, ws, id, name, color string) (*domain.Project, error) {
	n, err := cleanName(name, 120, "invalid_name")
	if err != nil {
		return nil, err
	}
	if !hexColor.MatchString(color) {
		existing, _ := s.repo.ListProjects(ctx, ws)
		color = projectColors[len(existing)%len(projectColors)]
	}
	p := &domain.Project{ID: id, WorkspaceID: ws, Name: n, Color: color, Statuses: domain.DefaultStatuses(uuid.NewString()[:8])}
	if err := s.repo.CreateProject(ctx, p); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "projects", "upsert", p)
	return p, nil
}

type ProjectPatch struct {
	Name     *string
	Color    *string
	Statuses *[]domain.Status
	Details  DetailsPatch
}

// DetailsPatch changes Space/List details; each field may be absent, set, or cleared with null.
type DetailsPatch struct {
	Description *string
	OwnerID     optional.Field[string]
	Priority    optional.Field[string]
	StartDate   optional.Field[string]
	DueDate     optional.Field[string]
}

func (p DetailsPatch) apply(d *domain.Details) error {
	if p.Description != nil {
		desc := strings.TrimSpace(*p.Description)
		if len(desc) > 5000 {
			return apperror.Invalid("invalid_description", "description must be under 5000 characters")
		}
		d.Description = desc
	}
	if p.OwnerID.Set {
		d.OwnerID = p.OwnerID.Value
	}
	if p.Priority.Set {
		if p.Priority.Value != nil && !validPriorities[*p.Priority.Value] {
			return apperror.Invalid("invalid_priority", "priority must be urgent, high, normal or low")
		}
		d.Priority = p.Priority.Value
	}
	for _, f := range []struct {
		in  optional.Field[string]
		out **string
	}{{p.StartDate, &d.StartDate}, {p.DueDate, &d.DueDate}} {
		if !f.in.Set {
			continue
		}
		if err := validDate(f.in.Value); err != nil {
			return err
		}
		*f.out = f.in.Value
	}
	if d.StartDate != nil && d.DueDate != nil && *d.StartDate > *d.DueDate {
		return apperror.Invalid("invalid_dates", "start date must be on or before the due date")
	}
	return nil
}

func validateStatuses(sts []domain.Status) error {
	if len(sts) == 0 || len(sts) > 20 {
		return apperror.Invalid("invalid_statuses", "a project needs 1-20 statuses")
	}
	seen := map[string]bool{}
	hasDone := false
	for _, st := range sts {
		if st.ID == "" || seen[st.ID] || st.Name == "" || !hexColor.MatchString(st.Color) {
			return apperror.Invalid("invalid_statuses", "each status needs a unique id, a name and a #rrggbb color")
		}
		switch st.Type {
		case domain.StatusOpen, domain.StatusActive, domain.StatusDone, domain.StatusClosed:
		default:
			return apperror.Invalid("invalid_statuses", "status type must be open, active, done or closed")
		}
		hasDone = hasDone || st.Finished()
		seen[st.ID] = true
	}
	if !hasDone {
		return apperror.Invalid("invalid_statuses", "at least one status must be done or closed")
	}
	return nil
}

func (s *Service) UpdateProject(ctx context.Context, ws, id string, p ProjectPatch) (*domain.Project, error) {
	proj, err := s.repo.GetProject(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.Name != nil {
		if proj.Name, err = cleanName(*p.Name, 120, "invalid_name"); err != nil {
			return nil, err
		}
	}
	if p.Color != nil {
		if !hexColor.MatchString(*p.Color) {
			return nil, apperror.Invalid("invalid_color", "color must be #rrggbb")
		}
		proj.Color = *p.Color
	}
	if p.Statuses != nil {
		if err := validateStatuses(*p.Statuses); err != nil {
			return nil, err
		}
		proj.Statuses = *p.Statuses
	}
	if err := p.Details.apply(&proj.Details); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateProject(ctx, proj); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "projects", "upsert", proj)
	return proj, nil
}

// DeleteProject cascades in the database; clients drop the project's folders,
// lists, tasks, sprints and automations when they receive the delete.
func (s *Service) DeleteProject(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteProject(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "projects", id)
	return nil
}

func (s *Service) CreateFolder(ctx context.Context, ws, id, projectID, name string) (*domain.Folder, error) {
	n, err := cleanName(name, 120, "invalid_name")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.GetProject(ctx, ws, projectID); err != nil {
		return nil, err
	}
	f := &domain.Folder{ID: id, WorkspaceID: ws, ProjectID: projectID, Name: n}
	if err := s.repo.CreateFolder(ctx, f); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "folders", "upsert", f)
	return f, nil
}

func (s *Service) RenameFolder(ctx context.Context, ws, id, name string) (*domain.Folder, error) {
	f, err := s.repo.GetFolder(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if f.Name, err = cleanName(name, 120, "invalid_name"); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateFolder(ctx, f); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "folders", "upsert", f)
	return f, nil
}

func (s *Service) DeleteFolder(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteFolder(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "folders", id)
	return nil
}

func (s *Service) CreateList(ctx context.Context, ws, id, projectID string, folderID *string, name string) (*domain.List, error) {
	n, err := cleanName(name, 120, "invalid_name")
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.GetProject(ctx, ws, projectID); err != nil {
		return nil, err
	}
	if folderID != nil {
		f, err := s.repo.GetFolder(ctx, ws, *folderID)
		if err != nil {
			return nil, err
		}
		if f.ProjectID != projectID {
			return nil, apperror.Invalid("folder_mismatch", "folder belongs to another project")
		}
	}
	l := &domain.List{ID: id, WorkspaceID: ws, ProjectID: projectID, FolderID: folderID, Name: n}
	if err := s.repo.CreateList(ctx, l); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "lists", "upsert", l)
	return l, nil
}

// UpdateList renames a List and/or changes its details.
func (s *Service) UpdateList(ctx context.Context, ws, id string, name *string, details DetailsPatch) (*domain.List, error) {
	l, err := s.repo.GetList(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if name != nil {
		if l.Name, err = cleanName(*name, 120, "invalid_name"); err != nil {
			return nil, err
		}
	}
	if err := details.apply(&l.Details); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateList(ctx, l); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "lists", "upsert", l)
	return l, nil
}

func (s *Service) DeleteList(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteList(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "lists", id)
	return nil
}

// ApplyTemplate creates a List pre-filled from one of the built-in templates.
func (s *Service) ApplyTemplate(ctx context.Context, ws, actorID, id, projectID, key, name string) (*domain.List, error) {
	tpl, ok := templates[key]
	if !ok {
		return nil, apperror.NotFound("template_not_found", "template not found")
	}
	if name == "" {
		name = tpl.Name
	}
	proj, err := s.repo.GetProject(ctx, ws, projectID)
	if err != nil {
		return nil, err
	}
	l, err := s.CreateList(ctx, ws, id, projectID, nil, name)
	if err != nil {
		return nil, err
	}
	for _, tt := range tpl.Tasks {
		in := TaskInput{ListID: l.ID, Title: tt.Title, StatusID: proj.FirstOfType(tt.Status).ID, Priority: tt.Priority, Tags: tt.Tags}
		if tt.Due != nil {
			d := s.now().AddDate(0, 0, *tt.Due).Format(dateLayout)
			in.DueDate = &d
		}
		t, err := s.CreateTask(ctx, ws, actorID, in)
		if err != nil {
			return nil, err
		}
		for _, sub := range tt.Subtasks {
			if _, err := s.CreateTask(ctx, ws, actorID, TaskInput{ListID: l.ID, ParentID: &t.ID, Title: sub, StatusID: proj.FirstOfType(domain.StatusOpen).ID}); err != nil {
				return nil, err
			}
		}
	}
	return l, nil
}
