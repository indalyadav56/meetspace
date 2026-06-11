package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/chat/domain"
)

type ChannelRepository struct {
	db *sql.DB
}

func NewChannelRepository(db *sql.DB) *ChannelRepository {
	return &ChannelRepository{db: db}
}

const channelCols = `id, team_id, name, description, private, created_at`

func (r *ChannelRepository) ListByTeam(ctx context.Context, teamID string) ([]domain.Channel, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+channelCols+` FROM channels WHERE team_id = $1 ORDER BY name`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var channels []domain.Channel
	for rows.Next() {
		var ch domain.Channel
		if err := rows.Scan(&ch.ID, &ch.TeamID, &ch.Name, &ch.Description, &ch.Private, &ch.CreatedAt); err != nil {
			return nil, err
		}
		channels = append(channels, ch)
	}
	return channels, rows.Err()
}

func (r *ChannelRepository) FindByID(ctx context.Context, id string) (*domain.Channel, error) {
	var ch domain.Channel
	err := r.db.QueryRowContext(ctx,
		`SELECT `+channelCols+` FROM channels WHERE id = $1`, id).
		Scan(&ch.ID, &ch.TeamID, &ch.Name, &ch.Description, &ch.Private, &ch.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrChannelNotFound
	}
	if err != nil {
		return nil, err
	}
	return &ch, nil
}

func (r *ChannelRepository) Create(ctx context.Context, ch *domain.Channel) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO channels (id, team_id, name, description, private, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		ch.ID, ch.TeamID, ch.Name, ch.Description, ch.Private, ch.CreatedAt)
	return err
}
