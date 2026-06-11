package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/indalyadav56/meetspace/backend/internal/workspace/domain"
)

type TeamRepository struct {
	db *sql.DB
}

func NewTeamRepository(db *sql.DB) *TeamRepository {
	return &TeamRepository{db: db}
}

const teamCols = `id, name, key, description, color, icon, lead_id, member_ids, created_at`

func (r *TeamRepository) List(ctx context.Context) ([]domain.Team, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+teamCols+` FROM teams ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []domain.Team
	for rows.Next() {
		t, err := scanTeam(rows)
		if err != nil {
			return nil, err
		}
		teams = append(teams, *t)
	}
	return teams, rows.Err()
}

func (r *TeamRepository) FindByID(ctx context.Context, id string) (*domain.Team, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+teamCols+` FROM teams WHERE id = $1`, id)
	t, err := scanTeam(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrTeamNotFound
	}
	return t, err
}

func (r *TeamRepository) Create(ctx context.Context, t *domain.Team) error {
	members, err := json.Marshal(t.MemberIDs)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO teams (id, name, key, description, color, icon, lead_id, member_ids, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		t.ID, t.Name, t.Key, t.Description, t.Color, t.Icon, t.LeadID, members, t.CreatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return domain.ErrTeamKeyTaken
	}
	return err
}

func scanTeam(row rowScanner) (*domain.Team, error) {
	var t domain.Team
	var members []byte
	err := row.Scan(&t.ID, &t.Name, &t.Key, &t.Description, &t.Color, &t.Icon,
		&t.LeadID, &members, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(members, &t.MemberIDs); err != nil {
		return nil, err
	}
	return &t, nil
}
