// Package application implements workspace use cases.
package application

import (
	"context"
	"regexp"
	"strings"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
	"github.com/indalyadav56/meetspace/backend/pkg/apperror"
)

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type Service struct {
	repo          domain.Repository
	pub           Publisher
	inviter       UserInviter
	users         UserDirectory
	notifier      InviteNotifier
	bootstrappers []Bootstrapper
}

func NewService(repo domain.Repository, pub Publisher, inviter UserInviter, users UserDirectory, notifier InviteNotifier, bootstrappers ...Bootstrapper) *Service {
	return &Service{repo: repo, pub: pub, inviter: inviter, users: users, notifier: notifier, bootstrappers: bootstrappers}
}

func cleanName(n string) (string, error) {
	n = strings.TrimSpace(n)
	if n == "" || len(n) > 120 {
		return "", domain.ErrInvalidName
	}
	return n, nil
}

func (s *Service) Create(ctx context.Context, userID, id, name, color string) (*domain.Workspace, error) {
	n, err := cleanName(name)
	if err != nil {
		return nil, err
	}
	if !hexColor.MatchString(color) {
		color = "#4f46e5"
	}
	w := &domain.Workspace{ID: id, Name: n, Color: color, CreatedBy: userID}
	if err := s.repo.Create(ctx, w, userID); err != nil {
		return nil, err
	}
	for _, b := range s.bootstrappers {
		if err := b.Bootstrap(ctx, w.ID, userID); err != nil {
			return nil, err
		}
	}
	return s.repo.Get(ctx, w.ID)
}

// AllIDs lists every workspace, for maintenance jobs.
func (s *Service) AllIDs(ctx context.Context) ([]string, error) { return s.repo.AllIDs(ctx) }

func (s *Service) ListForUser(ctx context.Context, userID string) ([]domain.Workspace, error) {
	return s.repo.ListForUser(ctx, userID)
}

// Role returns the caller's role, or ErrNotMember.
func (s *Service) Role(ctx context.Context, workspaceID, userID string) (domain.Role, error) {
	return s.repo.Role(ctx, workspaceID, userID)
}

// CanManage reports whether the user is an owner or admin of the workspace.
func (s *Service) CanManage(ctx context.Context, workspaceID, userID string) (bool, error) {
	r, err := s.repo.Role(ctx, workspaceID, userID)
	if err == domain.ErrNotMember {
		return false, nil
	}
	return err == nil && r.CanManage(), err
}

// IsMember satisfies other contexts' membership ports.
func (s *Service) IsMember(ctx context.Context, workspaceID, userID string) (bool, error) {
	_, err := s.repo.Role(ctx, workspaceID, userID)
	if err == domain.ErrNotMember {
		return false, nil
	}
	return err == nil, err
}

// Roles maps each member to their role; other contexts use it for access rules.
func (s *Service) Roles(ctx context.Context, workspaceID string) (map[string]string, error) {
	w, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string, len(w.Members))
	for _, m := range w.Members {
		out[m.UserID] = string(m.Role)
	}
	return out, nil
}

// Name returns the workspace's name, or "" when it can't be read.
func (s *Service) Name(ctx context.Context, workspaceID string) string {
	w, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		return ""
	}
	return w.Name
}

// MemberIDs lists user ids in a workspace (used for chat channels and notifications).
func (s *Service) MemberIDs(ctx context.Context, workspaceID string) ([]string, error) {
	w, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(w.Members))
	for i, m := range w.Members {
		ids[i] = m.UserID
	}
	return ids, nil
}

func (s *Service) NextTaskKey(ctx context.Context, workspaceID string) (int64, error) {
	return s.repo.NextTaskKey(ctx, workspaceID)
}

func (s *Service) requireManager(ctx context.Context, workspaceID, actorID string) error {
	r, err := s.repo.Role(ctx, workspaceID, actorID)
	if err != nil {
		return err
	}
	if !r.CanManage() {
		return domain.ErrForbidden
	}
	return nil
}

func (s *Service) Update(ctx context.Context, workspaceID, actorID string, name, color *string) (*domain.Workspace, error) {
	if err := s.requireManager(ctx, workspaceID, actorID); err != nil {
		return nil, err
	}
	w, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if name != nil {
		n, err := cleanName(*name)
		if err != nil {
			return nil, err
		}
		w.Name = n
	}
	if color != nil {
		if !hexColor.MatchString(*color) {
			return nil, apperror.Invalid("invalid_color", "color must be #rrggbb")
		}
		w.Color = *color
	}
	if err := s.repo.Update(ctx, w); err != nil {
		return nil, err
	}
	s.pub.Publish(ctx, workspaceID, "workspaces", "upsert", w, nil)
	return w, nil
}

func (s *Service) Delete(ctx context.Context, workspaceID, actorID string) error {
	r, err := s.repo.Role(ctx, workspaceID, actorID)
	if err != nil {
		return err
	}
	if r != domain.RoleOwner {
		return domain.ErrForbidden
	}
	if err := s.repo.Delete(ctx, workspaceID); err != nil {
		return err
	}
	s.pub.Publish(ctx, workspaceID, "workspaces", "delete", map[string]string{"id": workspaceID}, nil)
	return nil
}

// Invite adds a person by email (creating an invited account if needed).
func (s *Service) Invite(ctx context.Context, workspaceID, actorID, email, name string, role domain.Role) (map[string]any, error) {
	if err := s.requireManager(ctx, workspaceID, actorID); err != nil {
		return nil, err
	}
	if !role.Valid() || role == domain.RoleOwner {
		return nil, domain.ErrInvalidRole
	}
	uid, created, err := s.inviter.FindOrInvite(ctx, email, name)
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.Role(ctx, workspaceID, uid); err == nil {
		return nil, apperror.Conflict("already_member", "that person is already in this workspace")
	}
	m := domain.Member{UserID: uid, Role: role, Invited: created}
	if err := s.repo.UpsertMember(ctx, workspaceID, m); err != nil {
		return nil, err
	}
	if s.notifier != nil {
		if w, err := s.repo.Get(ctx, workspaceID); err == nil {
			// Email is best-effort and must not slow down or fail the invite.
			go s.notifier.NotifyInvite(context.WithoutCancel(ctx), email, actorID, w.Name)
		}
	}
	return s.publishMember(ctx, workspaceID, m)
}

func (s *Service) SetRole(ctx context.Context, workspaceID, actorID, userID string, role domain.Role) (map[string]any, error) {
	if err := s.requireManager(ctx, workspaceID, actorID); err != nil {
		return nil, err
	}
	if !role.Valid() {
		return nil, domain.ErrInvalidRole
	}
	cur, err := s.repo.Role(ctx, workspaceID, userID)
	if err != nil {
		return nil, err
	}
	actorRole, _ := s.repo.Role(ctx, workspaceID, actorID)
	// Only owners can create or demote owners.
	if (role == domain.RoleOwner || cur == domain.RoleOwner) && actorRole != domain.RoleOwner {
		return nil, domain.ErrForbidden
	}
	if cur == domain.RoleOwner && role != domain.RoleOwner {
		if n, err := s.repo.CountOwners(ctx, workspaceID); err != nil {
			return nil, err
		} else if n < 2 {
			return nil, domain.ErrLastOwner
		}
	}
	m := domain.Member{UserID: userID, Role: role}
	if all, err := s.memberSet(ctx, workspaceID); err == nil {
		// Keep title and manager in the published copy.
		m.Title, m.ManagerID, m.Invited = all[userID].Title, all[userID].ManagerID, all[userID].Invited
	}
	if err := s.repo.UpsertMember(ctx, workspaceID, m); err != nil {
		return nil, err
	}
	return s.publishMember(ctx, workspaceID, m)
}

func (s *Service) RemoveMember(ctx context.Context, workspaceID, actorID, userID string) error {
	if actorID != userID { // anyone may leave; removing others needs a manager
		if err := s.requireManager(ctx, workspaceID, actorID); err != nil {
			return err
		}
	}
	cur, err := s.repo.Role(ctx, workspaceID, userID)
	if err != nil {
		return err
	}
	if cur == domain.RoleOwner {
		if n, err := s.repo.CountOwners(ctx, workspaceID); err != nil {
			return err
		} else if n < 2 {
			return domain.ErrLastOwner
		}
	}
	if err := s.repo.RemoveMember(ctx, workspaceID, userID); err != nil {
		return err
	}
	s.pub.Publish(ctx, workspaceID, "members", "delete", map[string]string{"id": userID, "userId": userID}, nil)
	return nil
}

func (s *Service) publishMember(ctx context.Context, workspaceID string, m domain.Member) (map[string]any, error) {
	profiles, err := s.users.ProfilesMap(ctx, []string{m.UserID})
	if err != nil {
		return nil, err
	}
	out := map[string]any{"userId": m.UserID, "role": m.Role, "invited": m.Invited, "title": m.Title, "managerId": m.ManagerID}
	s.pub.Publish(ctx, workspaceID, "members", "upsert", out, nil)
	if len(profiles) == 1 {
		s.pub.Publish(ctx, workspaceID, "users", "upsert", profiles[0], nil)
	}
	return out, nil
}

// Snapshot returns the workspace, its members and their public profiles.
func (s *Service) Snapshot(ctx context.Context, workspaceID, _ string) (map[string]any, error) {
	w, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(w.Members))
	for i, m := range w.Members {
		ids[i] = m.UserID
	}
	profiles, err := s.users.ProfilesMap(ctx, ids)
	if err != nil {
		return nil, err
	}
	teams, err := s.repo.ListTeams(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"workspace": w, "members": w.Members, "users": profiles, "teams": teams}, nil
}
