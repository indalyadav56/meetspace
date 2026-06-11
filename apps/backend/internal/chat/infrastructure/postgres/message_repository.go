package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/indalyadav56/meetspace/backend/internal/chat/domain"
)

type MessageRepository struct {
	db *sql.DB
}

func NewMessageRepository(db *sql.DB) *MessageRepository {
	return &MessageRepository{db: db}
}

const messageCols = `id, conversation_id, author_id, body, parent_id, edited, system, created_at`

func (r *MessageRepository) ListByConversation(ctx context.Context, conversationID string) ([]domain.Message, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+messageCols+` FROM messages WHERE conversation_id = $1 ORDER BY created_at`,
		conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []domain.Message
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		messages = append(messages, *m)
	}
	return messages, rows.Err()
}

func (r *MessageRepository) FindByID(ctx context.Context, id string) (*domain.Message, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+messageCols+` FROM messages WHERE id = $1`, id)
	m, err := scanMessage(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrMessageNotFound
	}
	return m, err
}

func (r *MessageRepository) Create(ctx context.Context, m *domain.Message) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO messages (id, conversation_id, author_id, body, parent_id, edited, system, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		m.ID, m.ConversationID, m.AuthorID, m.Body, m.ParentID, m.Edited, m.System, m.CreatedAt)
	return err
}

type rowScanner interface{ Scan(dest ...any) error }

func scanMessage(row rowScanner) (*domain.Message, error) {
	var m domain.Message
	var parent sql.NullString
	err := row.Scan(&m.ID, &m.ConversationID, &m.AuthorID, &m.Body, &parent,
		&m.Edited, &m.System, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	if parent.Valid {
		m.ParentID = &parent.String
	}
	return &m, nil
}
