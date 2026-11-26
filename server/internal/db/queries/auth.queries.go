package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"

	"github.com/google/uuid"
)

const userColumns = `id, username, email, role, created_at, avatar_type, avatar_url, decoration, color_hue`

func scanUser(row *sql.Row) (*models.User, error) {
	var user models.User
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &user.AvatarType, &user.AvatarURL, &user.Decoration, &user.ColorHue)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserByClerkID(repo *sql.DB, ctx context.Context, clerkID string) (*models.User, error) {
	query := `SELECT ` + userColumns + ` FROM users WHERE clerk_id = ?`
	return scanUser(repo.QueryRowContext(ctx, query, clerkID))
}

// LinkClerkIDByEmail attaches a Clerk account to the pre-Clerk user with the
// same email (case-insensitive) and returns that user.
func LinkClerkIDByEmail(repo *sql.DB, ctx context.Context, clerkID string, email string) (*models.User, error) {
	query := `
        UPDATE users SET clerk_id = ?
        WHERE lower(email) = lower(?)
        RETURNING ` + userColumns
	return scanUser(repo.QueryRowContext(ctx, query, clerkID, email))
}

func CreateClerkUser(repo *sql.DB, ctx context.Context, clerkID string, username string, email string) (*models.User, error) {
	query := `
        INSERT INTO users (id, clerk_id, username, email)
        VALUES (?, ?, ?, ?)
        RETURNING ` + userColumns
	return scanUser(repo.QueryRowContext(ctx, query, uuid.New().String(), clerkID, username, email))
}
