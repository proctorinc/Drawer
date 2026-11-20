package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const announcementColumns = `a.id, a.title, a.body, a.art, a.image_url, a.cta_label, a.cta_url, a.position, a.active, a.starts_at, a.expires_at`

func scanAnnouncement(row eventRowScanner, extra ...any) (models.Announcement, error) {
	var (
		a                  models.Announcement
		startsAt, expireAt string
	)
	dest := append([]any{&a.ID, &a.Title, &a.Body, &a.Art, &a.ImageURL, &a.CTALabel, &a.CTAURL, &a.Position, &a.Active, &startsAt, &expireAt}, extra...)
	if err := row.Scan(dest...); err != nil {
		return models.Announcement{}, err
	}
	var err error
	if a.StartsAt, err = time.Parse(time.RFC3339, startsAt); err != nil {
		return models.Announcement{}, fmt.Errorf("error parsing starts_at for announcement %s: %w", a.ID, err)
	}
	if a.ExpiresAt, err = time.Parse(time.RFC3339, expireAt); err != nil {
		return models.Announcement{}, fmt.Errorf("error parsing expires_at for announcement %s: %w", a.ID, err)
	}
	return a, nil
}

// GetLiveAnnouncements returns the active announcements whose window covers now, in the order
// they're shown, each marked with whether this player has already seen it.
func GetLiveAnnouncements(repo *sql.DB, ctx context.Context, userID string, now time.Time) ([]models.PlayerAnnouncement, error) {
	nowStr := formatEventTime(now)
	rows, err := repo.QueryContext(ctx, `
		SELECT `+announcementColumns+`, v.user_id IS NOT NULL
		FROM announcements a
		LEFT JOIN announcement_views v ON v.announcement_id = a.id AND v.user_id = ?
		WHERE a.active = 1 AND a.starts_at <= ? AND a.expires_at > ?
		ORDER BY a.position, a.starts_at, a.id`, userID, nowStr, nowStr)
	if err != nil {
		return nil, fmt.Errorf("error fetching announcements: %w", err)
	}
	defer rows.Close()

	list := []models.PlayerAnnouncement{}
	for rows.Next() {
		var seen bool
		a, err := scanAnnouncement(rows, &seen)
		if err != nil {
			return nil, fmt.Errorf("error scanning announcement: %w", err)
		}
		list = append(list, models.PlayerAnnouncement{Announcement: a, Seen: seen})
	}
	return list, rows.Err()
}

// MarkAnnouncementsSeen records that the player has seen these announcements. Ids that
// don't exist are ignored.
func MarkAnnouncementsSeen(repo *sql.DB, ctx context.Context, userID string, ids []string) error {
	return withEventTx(repo, ctx, func(tx *sql.Tx) error {
		for _, id := range ids {
			_, err := tx.ExecContext(ctx, `
				INSERT OR IGNORE INTO announcement_views (user_id, announcement_id)
				SELECT ?, id FROM announcements WHERE id = ?`, userID, id)
			if err != nil {
				return fmt.Errorf("error marking announcement %s seen: %w", id, err)
			}
		}
		return nil
	})
}

// ListAnnouncements returns every announcement, newest window first, for admins.
func ListAnnouncements(repo *sql.DB, ctx context.Context) ([]models.AdminAnnouncement, error) {
	rows, err := repo.QueryContext(ctx, `
		SELECT `+announcementColumns+`, (SELECT COUNT(*) FROM announcement_views v WHERE v.announcement_id = a.id)
		FROM announcements a
		ORDER BY a.starts_at DESC, a.position, a.id`)
	if err != nil {
		return nil, fmt.Errorf("error listing announcements: %w", err)
	}
	defer rows.Close()

	list := []models.AdminAnnouncement{}
	for rows.Next() {
		var seenBy int
		a, err := scanAnnouncement(rows, &seenBy)
		if err != nil {
			return nil, fmt.Errorf("error scanning announcement: %w", err)
		}
		list = append(list, models.AdminAnnouncement{Announcement: a, SeenBy: seenBy})
	}
	return list, rows.Err()
}

// SaveAnnouncement creates the announcement when it has no id, else updates it
// (sql.ErrNoRows when there's no such announcement).
func SaveAnnouncement(repo *sql.DB, ctx context.Context, a models.Announcement) (models.Announcement, error) {
	args := []any{a.Title, a.Body, a.Art, a.ImageURL, a.CTALabel, a.CTAURL, a.Position, a.Active, formatEventTime(a.StartsAt), formatEventTime(a.ExpiresAt)}
	if a.ID == "" {
		a.ID = uuid.NewString()
		_, err := repo.ExecContext(ctx, `
			INSERT INTO announcements (title, body, art, image_url, cta_label, cta_url, position, active, starts_at, expires_at, id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, append(args, a.ID)...)
		if err != nil {
			return models.Announcement{}, fmt.Errorf("error creating announcement: %w", err)
		}
		return a, nil
	}
	res, err := repo.ExecContext(ctx, `
		UPDATE announcements SET title = ?, body = ?, art = ?, image_url = ?, cta_label = ?, cta_url = ?, position = ?, active = ?, starts_at = ?, expires_at = ?
		WHERE id = ?`, append(args, a.ID)...)
	if err != nil {
		return models.Announcement{}, fmt.Errorf("error updating announcement: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return models.Announcement{}, sql.ErrNoRows
	}
	return a, nil
}

// DeleteAnnouncement removes an announcement and who saw it (sql.ErrNoRows when there's none).
func DeleteAnnouncement(repo *sql.DB, ctx context.Context, id string) error {
	return withEventTx(repo, ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM announcement_views WHERE announcement_id = ?`, id); err != nil {
			return fmt.Errorf("error deleting announcement views: %w", err)
		}
		res, err := tx.ExecContext(ctx, `DELETE FROM announcements WHERE id = ?`, id)
		if err != nil {
			return fmt.Errorf("error deleting announcement: %w", err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return sql.ErrNoRows
		}
		return nil
	})
}

// ResetAnnouncementViews forgets who has seen an announcement, so it pops up for everyone again.
func ResetAnnouncementViews(repo *sql.DB, ctx context.Context, id string) error {
	if _, err := repo.ExecContext(ctx, `DELETE FROM announcement_views WHERE announcement_id = ?`, id); err != nil {
		return fmt.Errorf("error resetting announcement views: %w", err)
	}
	return nil
}
