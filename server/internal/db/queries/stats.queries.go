package queries

import (
	"context"
	"database/sql"
	"time"
)

type DailyActionStat struct {
	Date      string	`json:"date"`
	Drawings  int		`json:"drawings"`
	Reactions int		`json:"reactions"`
	Comments  int		`json:"comments"`
}

// GetDailyActionStats returns, for each day in the range [start, end], the count of drawings, reactions, and comments.
// Days with zero actions are included.
func GetDailyActionStats(db *sql.DB, ctx context.Context, start, end string) ([]DailyActionStat, error) {
	// Generate all days in the range
	layout := "2006-01-02"
	startDate, err := time.Parse(layout, start)
	if err != nil {
		return nil, err
	}
	endDate, err := time.Parse(layout, end)
	if err != nil {
		return nil, err
	}
	days := []string{}
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		days = append(days, d.Format(layout))
	}

	// Query for all actions in the range
	drawings := make(map[string]int)
	reactions := make(map[string]int)
	comments := make(map[string]int)

	// Drawings
	drawingRows, err := db.QueryContext(ctx, `SELECT day, COUNT(*) FROM user_submissions WHERE day >= ? AND day <= ? GROUP BY day`, start, end)
	if err != nil {
		return nil, err
	}
	defer drawingRows.Close()
	for drawingRows.Next() {
		var day string
		var count int
		if err := drawingRows.Scan(&day, &count); err == nil {
			drawings[day] = count
		}
	}

	// Reactions (on submissions and comments)
	reactionRows, err := db.QueryContext(ctx, `SELECT date(created_at) as day, COUNT(*) FROM reactions WHERE day >= ? AND day <= ? GROUP BY day`, start, end)
	if err != nil {
		return nil, err
	}
	defer reactionRows.Close()
	for reactionRows.Next() {
		var day string
		var count int
		if err := reactionRows.Scan(&day, &count); err == nil {
			reactions[day] = count
		}
	}

	// Comments
	commentRows, err := db.QueryContext(ctx, `SELECT date(created_at) as day, COUNT(*) FROM comments WHERE day >= ? AND day <= ? GROUP BY day`, start, end)
	if err != nil {
		return nil, err
	}
	defer commentRows.Close()
	for commentRows.Next() {
		var day string
		var count int
		if err := commentRows.Scan(&day, &count); err == nil {
			comments[day] = count
		}
	}

	// Build result
	result := make([]DailyActionStat, 0, len(days))
	for _, day := range days {
		result = append(result, DailyActionStat{
			Date:      day,
			Drawings:  drawings[day],
			Reactions: reactions[day],
			Comments:  comments[day],
		})
	}

	return result, nil
} 