package queries

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"errors"
	"fmt"
	"log"
	"time"
)

func GetUserByID(repo *sql.DB, ctx context.Context, userID string) (*models.User, error) {
	var user models.User
	query := `SELECT id, username, email, role, created_at, avatar_type, avatar_url, decoration FROM users WHERE id = ?`
	err := repo.QueryRowContext(ctx, query, userID).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &user.AvatarType, &user.AvatarURL, &user.Decoration)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

func GetUserFromDB(repo *sql.DB, ctx context.Context, userID string) (models.User, error) {
	query := `SELECT id, username, email, role, created_at, avatar_type, avatar_url, decoration FROM users WHERE id = ?`

	row := repo.QueryRowContext(ctx, query, userID)

	var user models.User
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &user.AvatarType, &user.AvatarURL, &user.Decoration)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, err
		}
		// Log the error for debugging
		log.Printf("Error fetching user %s: %v", userID, err)
		return models.User{}, fmt.Errorf("failed to fetch user: %w", err)
	}

	return user, nil
}

func GetUserProfileFromDB(repo *sql.DB, ctx context.Context, userID string, requesterID string, cfg *config.Config) (models.GetMeResponse, error) {
	var response models.GetMeResponse

	userQuery := `SELECT u.id, u.username, u.email, u.role, u.created_at, u.avatar_type, u.avatar_url, u.decoration, f.state, f.created_at,
			inviter.id, inviter.username, inviter.email, inviter.created_at, inviter.avatar_type, inviter.avatar_url, inviter.decoration
		FROM users u
		LEFT JOIN friendships f ON ((f.user1 = ? AND f.user2 = u.id) OR (f.user2 = ? AND f.user1 = u.id))
		LEFT JOIN users inviter ON inviter.id = f.inviter_id
		WHERE u.id = ?`
	var user models.User
	var nullStatus sql.NullString
	var nullCreatedAt, inviterCreatedAt sql.NullTime
	var inviterID, inviterUsername, inviterEmail, inviterAvatarType, inviterAvatarURL, inviterDecoration sql.NullString

	err := repo.QueryRowContext(ctx, userQuery, requesterID, requesterID, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &user.AvatarType, &user.AvatarURL, &user.Decoration, &nullStatus, &nullCreatedAt,
		&inviterID, &inviterUsername, &inviterEmail, &inviterCreatedAt, &inviterAvatarType, &inviterAvatarURL, &inviterDecoration)
	if err != nil {
		log.Printf("Error fetching user info for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}
	response.User = user

	if nullCreatedAt.Valid && nullStatus.Valid {
		response.Invitation = &models.InvitationStatus{
			Inviter: models.User{
				ID:         inviterID.String,
				Email:      inviterEmail.String,
				Username:   inviterUsername.String,
				CreatedAt:  inviterCreatedAt.Time,
				AvatarType: inviterAvatarType.String,
				AvatarURL:  inviterAvatarURL.String,
				Decoration: inviterDecoration.String,
			},
			CreatedAt: nullCreatedAt.Time,
			Status:    nullStatus.String,
		}
	}

	friendsQuery := `
		SELECT DISTINCT
			u.id,
			u.username,
			u.email,
			u.created_at,
			u.avatar_type,
			u.avatar_url, u.decoration
		FROM
			friendships f
		JOIN
			users u ON ((f.user1 = ? AND f.user2 = u.id) OR (f.user2 = ? AND f.user1 = u.id))
		WHERE f.state = 'accepted'
		ORDER BY u.username`
	friendsRows, err := repo.QueryContext(ctx, friendsQuery, userID, userID)
	if err != nil {
		log.Printf("Error fetching friends for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}
	defer friendsRows.Close()
	response.Friends = []models.User{}
	for friendsRows.Next() {
		var friend models.User
		err := friendsRows.Scan(&friend.ID, &friend.Username, &friend.Email, &friend.CreatedAt, &friend.AvatarType, &friend.AvatarURL, &friend.Decoration)
		if err != nil {
			log.Printf("Error scanning friend row: %v", err)
			continue
		}
		response.Friends = append(response.Friends, friend)
	}
	if err = friendsRows.Err(); err != nil {
		log.Printf("Error iterating friends rows: %v", err)
		return models.GetMeResponse{}, err
	}

	response.Prompts, err = loadSubmissions(repo, ctx, cfg, `us.user_id = ?`, userID)
	if err != nil {
		log.Printf("Error fetching submissions for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}
	response.Feed = []*models.UserPromptSubmission{}
	subMap := make(map[string]*models.UserPromptSubmission, len(response.Prompts))
	for _, sub := range response.Prompts {
		subMap[sub.ID] = sub
	}

	// Counted from their stats start day, like everything else that measures progress
	totalDrawings, err := CalculateSubmissionCount(repo, ctx, userID)
	if err != nil {
		log.Printf("Error fetching total drawings for user %s: %v", userID, err)
		return models.GetMeResponse{}, err
	}

	currentStreak, err := CalculateSubmissionActiveStreak(repo, ctx, userID)
	if err != nil {
		log.Printf("Error calculating streak for user %s: %v", userID, err)
		currentStreak = 0
	}

	response.Stats = models.UserStats{
		TotalDrawings: totalDrawings,
		CurrentStreak: currentStreak,
	}

	// Before favorites copy the submissions, so they come out hidden too
	if err := HideTodaysDrawings(repo, ctx, requesterID, response.Prompts); err != nil {
		log.Printf("Error checking whether user %s drew today: %v", requesterID, err)
	}

	favQuery := `SELECT id, submission_id, created_at, order_num FROM user_favorite_submissions WHERE user_id = ? ORDER BY order_num ASC`
	favRows, err := repo.QueryContext(ctx, favQuery, userID)
	if err != nil {
		log.Printf("Error fetching favorites for user %s: %v", userID, err)
		response.Favorites = []*models.FavoriteSubmission{}
	} else {
		defer favRows.Close()
		response.Favorites = []*models.FavoriteSubmission{}
		favoriteSet := make(map[string]struct{})
		for favRows.Next() {
			var favID, favSubmissionID string
			var favCreatedAt time.Time
			var favOrderNum int
			err := favRows.Scan(&favID, &favSubmissionID, &favCreatedAt, &favOrderNum)
			if err != nil {
				log.Printf("Error scanning favorite row: %v", err)
				continue
			}
			// Find the full UserPromptSubmission in subMap
			sub, exists := subMap[favSubmissionID]
			if !exists {
				continue // skip if not found
			}
			favoriteSet[favSubmissionID] = struct{}{}
			fav := &models.FavoriteSubmission{
				ID:         favID,
				Submission: *sub,
				CreatedAt:  favCreatedAt,
				OrderNum:   favOrderNum,
			}
			response.Favorites = append(response.Favorites, fav)
		}
		// Set IsFavorite only for user's own submissions
		for _, sub := range response.Prompts {
			if _, ok := favoriteSet[sub.ID]; ok {
				sub.IsFavorite = true
			}
		}
	}

	return response, nil
}

func GetUserFriends(repo *sql.DB, ctx context.Context, userID string) ([]string, error) {
	query := `
		SELECT user2 FROM friendships WHERE user1 = ? AND state = 'accepted'
		UNION
		SELECT user1 FROM friendships WHERE user2 = ? AND state = 'accepted'
	`
	rows, err := repo.QueryContext(ctx, query, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var friends []string
	for rows.Next() {
		var friendID string
		if err := rows.Scan(&friendID); err != nil {
			return nil, err
		}
		friends = append(friends, friendID)
	}
	return friends, nil
}

// GetAllUsers gets all users with optional username search
func GetAllUsers(repo *sql.DB, ctx context.Context, searchQuery string) ([]models.User, error) {
	var query string
	var args []interface{}

	if searchQuery != "" {
		query = `SELECT id, username, email, role, created_at, avatar_type, avatar_url, decoration FROM users WHERE username LIKE ? ORDER BY username ASC`
		args = []interface{}{"%" + searchQuery + "%"}
	} else {
		query = `SELECT id, username, email, role, created_at, avatar_type, avatar_url, decoration FROM users ORDER BY username ASC`
	}

	rows, err := repo.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &user.AvatarType, &user.AvatarURL, &user.Decoration)
		if err != nil {
			log.Printf("Error scanning user row: %v", err)
			continue
		}
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

// MaxAvatarSlots is how many drawn faces a user can keep at once
const MaxAvatarSlots = 3

// UserAvatar is one of a user's drawn faces
type UserAvatar struct {
	Slot int    `json:"slot"`
	URL  string `json:"url"`
}

// GetUserAvatars lists a user's drawn faces, by slot
func GetUserAvatars(repo *sql.DB, ctx context.Context, userID string) ([]UserAvatar, error) {
	rows, err := repo.QueryContext(ctx, `SELECT slot, url FROM user_avatars WHERE user_id = ? ORDER BY slot`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	avatars := []UserAvatar{}
	for rows.Next() {
		var a UserAvatar
		if err := rows.Scan(&a.Slot, &a.URL); err != nil {
			return nil, err
		}
		avatars = append(avatars, a)
	}
	return avatars, rows.Err()
}

// SaveUserAvatar puts a drawing in a slot, replacing whatever was there, and wears it
func SaveUserAvatar(repo *sql.DB, ctx context.Context, userID string, slot int, avatarURL string) error {
	tx, err := repo.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		INSERT INTO user_avatars (user_id, slot, url) VALUES (?, ?, ?)
		ON CONFLICT (user_id, slot) DO UPDATE SET url = excluded.url, created_at = CURRENT_TIMESTAMP`,
		userID, slot, avatarURL)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `UPDATE users SET avatar_type = 'custom', avatar_url = ? WHERE id = ?`, avatarURL, userID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// WearUserAvatar switches to a drawing the user already has in a slot.
// Returns sql.ErrNoRows when that slot is empty
func WearUserAvatar(repo *sql.DB, ctx context.Context, userID string, slot int) error {
	res, err := repo.ExecContext(ctx, `
		UPDATE users SET avatar_type = 'custom',
			avatar_url = (SELECT url FROM user_avatars WHERE user_id = ? AND slot = ?)
		WHERE id = ? AND EXISTS (SELECT 1 FROM user_avatars WHERE user_id = ? AND slot = ?)`,
		userID, slot, userID, userID, slot)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UpdateUserDecoration sets the decoration the user wears, or takes it off with ""
func UpdateUserDecoration(repo *sql.DB, ctx context.Context, userID string, decoration string) error {
	_, err := repo.ExecContext(ctx, `UPDATE users SET decoration = ? WHERE id = ?`, decoration, userID)
	return err
}

func UpdateUserAvatarType(repo *sql.DB, ctx context.Context, userID string, avatarType string) error {
	updateSQL := `
        UPDATE users
        SET avatar_type = ?
        WHERE id = ?
    `
	_, err := repo.ExecContext(ctx, updateSQL, avatarType, userID)

	if err != nil {
		return err
	}

	return nil
}
