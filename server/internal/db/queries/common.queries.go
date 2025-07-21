package queries

import (
	"context"
	"database/sql"
	"time"
)

// Overall stats
func GetTotalUserCount(repo *sql.DB, ctx context.Context) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	return count, err
}

func GetTotalDrawingCount(repo *sql.DB, ctx context.Context) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT COUNT(*) FROM user_submissions`).Scan(&count)
	return count, err
}

func GetTotalReactionCount(repo *sql.DB, ctx context.Context) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT COUNT(*) FROM reactions`).Scan(&count)
	return count, err
}

func GetTotalCommentCount(repo *sql.DB, ctx context.Context) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT COUNT(*) FROM comments`).Scan(&count)
	return count, err
}

// Recent/today stats
func GetRecentUsers(repo *sql.DB, ctx context.Context, days int, limit int) ([]struct {
	ID        string
	Username  string
	Email     string
	CreatedAt time.Time
}, error) {
	rows, err := repo.QueryContext(ctx, `SELECT id, username, email, created_at FROM users WHERE created_at >= date('now', ?) ORDER BY created_at DESC LIMIT ?`,
		-1*days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []struct {
		ID        string
		Username  string
		Email     string
		CreatedAt time.Time
	}
	for rows.Next() {
		var u struct {
			ID        string
			Username  string
			Email     string
			CreatedAt time.Time
		}
		err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.CreatedAt)
		if err != nil {
			continue
		}
		users = append(users, u)
	}
	return users, nil
}

func GetDrawingsToday(repo *sql.DB, ctx context.Context) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT COUNT(*) FROM user_submissions WHERE day = date('now')`).Scan(&count)
	return count, err
}

func GetReactionsToday(repo *sql.DB, ctx context.Context) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT COUNT(*) FROM reactions WHERE date(created_at) = date('now')`).Scan(&count)
	return count, err
}

func GetCommentsToday(repo *sql.DB, ctx context.Context) (int, error) {
	var count int
	err := repo.QueryRowContext(ctx, `SELECT COUNT(*) FROM comments WHERE date(created_at) = date('now')`).Scan(&count)
	return count, err
}
