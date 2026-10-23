package application

import (
	"context"
	"html"
	"net/mail"
	"strconv"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/work/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

var formFieldKinds = map[string]bool{"short": true, "long": true, "email": true, "select": true, "date": true, "priority": true, "number": true}

func validateForm(f *domain.Form) error {
	var err error
	if f.Title, err = cleanName(f.Title, 200, "invalid_title"); err != nil {
		return err
	}
	if !hexColor.MatchString(f.Color) {
		return apperror.Invalid("invalid_color", "color must be #rrggbb")
	}
	if len(f.Fields) > 50 {
		return apperror.Invalid("too_many_fields", "a form can have at most 50 questions")
	}
	for _, ff := range f.Fields {
		if ff.ID == "" || !formFieldKinds[ff.Kind] {
			return apperror.Invalid("invalid_field", "each question needs an id and a valid kind")
		}
		switch {
		case ff.Target == "title", ff.Target == "description", ff.Target == "dueDate", ff.Target == "priority", ff.Target == "none":
		case strings.HasPrefix(ff.Target, "custom:"):
		default:
			return apperror.Invalid("invalid_field", "unknown question target "+ff.Target)
		}
	}
	return nil
}

func (s *Service) CreateForm(ctx context.Context, ws, actorID, id, listID string) (*domain.Form, error) {
	if _, err := s.repo.GetList(ctx, ws, listID); err != nil {
		return nil, err
	}
	f := &domain.Form{
		ID:          id,
		WorkspaceID: ws, ListID: listID, Title: "Untitled form", Color: "#4f46e5", Active: true,
		Fields: []domain.FormField{
			{ID: "q1", Label: "Title", Kind: "short", Required: true, Options: []string{}, Target: "title"},
			{ID: "q2", Label: "Details", Kind: "long", Options: []string{}, Target: "description"},
		},
		AssignTo: []string{}, SubmitText: "Submit", ThanksText: "Thanks — your response was recorded.",
	}
	if err := s.repo.CreateForm(ctx, f); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "forms", "upsert", f)
	return f, nil
}

type FormPatch struct {
	ListID      *string             `json:"listId"`
	Title       *string             `json:"title"`
	Description *string             `json:"description"`
	Color       *string             `json:"color"`
	Fields      *[]domain.FormField `json:"fields"`
	AssignTo    *[]string           `json:"assignTo"`
	SubmitText  *string             `json:"submitText"`
	ThanksText  *string             `json:"thanksText"`
	Active      *bool               `json:"active"`
}

func (s *Service) UpdateForm(ctx context.Context, ws, id string, p FormPatch) (*domain.Form, error) {
	f, err := s.repo.GetForm(ctx, ws, id)
	if err != nil {
		return nil, err
	}
	if p.ListID != nil {
		if _, err := s.repo.GetList(ctx, ws, *p.ListID); err != nil {
			return nil, err
		}
		f.ListID = *p.ListID
	}
	if p.Title != nil {
		f.Title = *p.Title
	}
	if p.Description != nil {
		f.Description = *p.Description
	}
	if p.Color != nil {
		f.Color = *p.Color
	}
	if p.Fields != nil {
		f.Fields = *p.Fields
	}
	if p.AssignTo != nil {
		if err := s.requireMembers(ctx, ws, *p.AssignTo); err != nil {
			return nil, err
		}
		f.AssignTo = uniq(*p.AssignTo)
	}
	if p.SubmitText != nil {
		f.SubmitText = strings.TrimSpace(*p.SubmitText)
	}
	if p.ThanksText != nil {
		f.ThanksText = strings.TrimSpace(*p.ThanksText)
	}
	if p.Active != nil {
		f.Active = *p.Active
	}
	if err := validateForm(f); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateForm(ctx, f); err != nil {
		return nil, err
	}
	s.emit(ctx, ws, "forms", "upsert", f)
	return f, nil
}

func (s *Service) DeleteForm(ctx context.Context, ws, id string) error {
	if err := s.repo.DeleteForm(ctx, ws, id); err != nil {
		return err
	}
	s.deleted(ctx, ws, "forms", id)
	return nil
}

// PublicForm is what anyone with the link sees: no workspace internals.
type PublicForm struct {
	ID          string             `json:"id"`
	Title       string             `json:"title"`
	Description string             `json:"description"`
	Color       string             `json:"color"`
	Fields      []domain.FormField `json:"fields"`
	SubmitText  string             `json:"submitText"`
	ThanksText  string             `json:"thanksText"`
	Active      bool               `json:"active"`
}

func (s *Service) GetPublicForm(ctx context.Context, id string) (*PublicForm, error) {
	f, err := s.repo.GetFormPublic(ctx, id)
	if err != nil {
		return nil, err
	}
	return &PublicForm{ID: f.ID, Title: f.Title, Description: f.Description, Color: f.Color, Fields: f.Fields, SubmitText: f.SubmitText, ThanksText: f.ThanksText, Active: f.Active}, nil
}

// SubmitForm validates a response and turns it into a task in the form's List.
// It needs no authentication; the task is created by the bot.
func (s *Service) SubmitForm(ctx context.Context, id string, values map[string]string) (*domain.Task, error) {
	f, err := s.repo.GetFormPublic(ctx, id)
	if err != nil {
		return nil, err
	}
	if !f.Active {
		return nil, domain.ErrFormClosed
	}
	ws := f.WorkspaceID
	in := TaskInput{ListID: f.ListID, Assignees: f.AssignTo, Tags: []string{"form"}, Custom: map[string]any{}}
	var desc strings.Builder
	desc.WriteString("<p><em>Submitted via form “" + html.EscapeString(f.Title) + "”.</em></p>")
	fields, _ := s.repo.ListFields(ctx, ws)
	for _, ff := range f.Fields {
		v := strings.TrimSpace(values[ff.ID])
		if len(v) > 10000 {
			return nil, apperror.Invalid("answer_too_long", "an answer is too long")
		}
		if v == "" {
			if ff.Required {
				return nil, apperror.Invalid("missing_answer", "“"+ff.Label+"” is required")
			}
			continue
		}
		switch ff.Kind {
		case "email":
			if _, err := mail.ParseAddress(v); err != nil {
				return nil, apperror.Invalid("invalid_email", "“"+ff.Label+"” must be an email address")
			}
		case "number":
			if _, err := strconv.ParseFloat(v, 64); err != nil {
				return nil, apperror.Invalid("invalid_number", "“"+ff.Label+"” must be a number")
			}
		case "date":
			if err := validDate(&v); err != nil {
				return nil, err
			}
		}
		switch {
		case ff.Target == "title" && in.Title == "":
			in.Title = v
			continue
		case ff.Target == "dueDate":
			in.DueDate = &v
			continue
		case ff.Target == "priority" && validPriorities[v]:
			in.Priority = &v
			continue
		case strings.HasPrefix(ff.Target, "custom:"):
			fid := strings.TrimPrefix(ff.Target, "custom:")
			for _, cf := range fields {
				if cf.ID != fid {
					continue
				}
				switch cf.Type {
				case "number", "money":
					n, _ := strconv.ParseFloat(v, 64)
					in.Custom[fid] = n
				case "dropdown":
					for _, o := range cf.Options {
						if o.Name == v {
							in.Custom[fid] = o.ID
						}
					}
				default:
					in.Custom[fid] = v
				}
			}
			continue
		}
		desc.WriteString("<p><strong>" + html.EscapeString(ff.Label) + ":</strong> " + strings.ReplaceAll(html.EscapeString(v), "\n", "<br>") + "</p>")
	}
	if in.Title == "" {
		in.Title = f.Title + " response"
	}
	in.Description = desc.String()
	t, err := s.CreateTask(ctx, ws, domain.BotID, in)
	if err != nil {
		return nil, err
	}
	if updated, err := s.repo.IncrementSubmissions(ctx, ws, f.ID); err == nil {
		s.emit(ctx, ws, "forms", "upsert", updated)
	}
	return t, nil
}
