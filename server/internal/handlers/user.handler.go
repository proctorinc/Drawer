package handlers

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/achievements"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/storage"
	"drawer-service-backend/internal/utils"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func HandleGetMe(c *gin.Context) {
	user := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	response, err := queries.GetUserByID(appCtx.DB, c.Request.Context(), user.ID)
	if err != nil {
		log.Printf("Error querying user data for userId: %s (email: %s): %v", user.ID, utils.MaskEmail(user.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare user response"})
		return
	}

	account := response.Account()
	if hasBeta, err := queries.HasBetaAccess(appCtx.DB, c.Request.Context(), *response); err != nil {
		log.Printf("Error checking beta access for %s: %v", user.ID, err)
	} else {
		account.HasBeta = hasBeta
	}
	if admin := middleware.GetImpersonator(c); admin != nil {
		account.ImpersonatedBy = admin.Username
	}
	c.JSON(http.StatusCreated, account)
}

func HandleGetUserByID(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	requester := middleware.GetUser(c)

	userID := c.Param("id")
	if userID == "" {
		log.Printf("Empty user ID provided in request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	// Query the user from the database
	user, err := queries.GetUserProfileFromDB(appCtx.DB, c.Request.Context(), userID, requester.ID, appCtx.Config)

	if err != nil {
		log.Printf("Error retrieving user (ID: %s): %v",
			userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to add friend"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func HandleGetUserProfile(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	response, err := queries.GetUserProfileFromDB(appCtx.DB, c.Request.Context(), requester.ID, requester.ID, appCtx.Config)
	if err != nil {
		log.Printf("Error querying user profile data for userId: %s (email: %s): %v", requester.ID, utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare user response"})
		return
	}

	c.JSON(http.StatusCreated, response)
}

func HandleUpdateUsername(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	// Get the new username from the request body
	var body struct {
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		log.Printf("Invalid update username request body: %v", err)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Validate username
	if len(body.Username) < 2 {
		log.Printf("Invalid username length: %s", body.Username)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Username must be at least 2 characters long"})
		return
	}
	if len(body.Username) > 15 {
		log.Printf("Invalid username length: %s", body.Username)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Username max length is 15 characters"})
		return
	}
	if strings.Contains(body.Username, " ") {
		log.Printf("Invalid username containing spaces: %s", body.Username)
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Username cannot contain spaces"})
		return
	}

	// Check if username is already taken
	var existingUserID string
	err := appCtx.DB.QueryRowContext(c.Request.Context(), "SELECT id FROM users WHERE username = ? AND id != ?", body.Username, requester.ID).Scan(&existingUserID)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Error checking existing username '%s': %v", body.Username, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to check username availability"})
		return
	}
	if err == nil {
		log.Printf("Username '%s' already taken when user %s (email: %s) attempted to update",
			body.Username, requester.ID, utils.MaskEmail(requester.Email))
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	// Update the username
	_, err = appCtx.DB.ExecContext(c.Request.Context(), "UPDATE users SET username = ? WHERE id = ?", body.Username, requester.ID)
	if err != nil {
		log.Printf("Error updating username for user %s (email: %s): %v",
			requester.ID, utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update username"})
		return
	}

	log.Printf("Successfully updated username for user %s (email: %s) to '%s'",
		requester.ID, utils.MaskEmail(requester.Email), body.Username)
	c.JSON(http.StatusOK, gin.H{"message": "Username updated successfully"})
}

func HandleInviteFriend(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	// Get the friend's user ID from the URL param
	friendID := c.Param("id")
	if friendID == "" {
		log.Printf("Empty user ID provided in request")
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	if requester.ID == friendID {
		log.Printf("User %s (email: %s) attempted to invite themselves as a friend", requester.ID, utils.MaskEmail(requester.Email))
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "You cannot invite yourself as a friend"})
		return
	}

	// Determine user1 and user2 (user1 > user2)
	user1, user2 := requester.ID, friendID
	if user1 < user2 {
		user1, user2 = user2, user1
	}

	// Check if friendship already exists (pending or accepted)
	var exists bool
	err := appCtx.DB.QueryRowContext(c.Request.Context(),
		"SELECT EXISTS(SELECT 1 FROM friendships WHERE user1 = ? AND user2 = ?)", user1, user2).Scan(&exists)
	if err != nil {
		log.Printf("Error checking existing friendship between users %s and %s: %v", user1, user2, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to check friendship status"})
		return
	}
	if exists {
		log.Printf("Friendship or invitation already exists between users %s and %s", user1, user2)
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "Friendship or invitation already exists"})
		return
	}

	// Insert the friendship invitation in 'pending' state, set inviter_id to requester.ID
	insertSQL := `INSERT INTO friendships (user1, user2, state, inviter_id) VALUES (?, ?, 'pending', ?)`
	_, err = appCtx.DB.ExecContext(c.Request.Context(), insertSQL, user1, user2, requester.ID)
	if err != nil {
		log.Printf("Error inviting friend (ID: %s) for user %s (email: %s): %v", friendID, requester.ID, utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to invite friend"})
		return
	}

	log.Printf("Successfully invited user (ID: %s) to be friends with user %s (email: %s)", friendID, requester.ID, utils.MaskEmail(requester.Email))
	c.JSON(http.StatusOK, gin.H{"message": "Friend invitation sent"})
}

// Handler to get all pending invitations for the current user
func HandleGetInvitations(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	// Query all pending invitations where the user is either user1 or user2, join inviter user object
	query := `
		SELECT f.created_at,
			user1, user1.username, user1.email, user1.created_at, user1.avatar_type, user1.avatar_url, user1.decoration,
			user2, user2.username, user2.email, user2.created_at, user2.avatar_type, user2.avatar_url, user2.decoration,
			inviter.id, inviter.username, inviter.email, inviter.created_at, inviter.avatar_type, inviter.avatar_url, inviter.decoration
		FROM friendships f
		JOIN users inviter ON f.inviter_id = inviter.id
		JOIN users user1 ON f.user1 = user1.id
		JOIN users user2 ON f.user2 = user2.id
		WHERE (f.user1 = ? OR f.user2 = ?) AND f.state = 'pending'
	`
	rows, err := appCtx.DB.QueryContext(c.Request.Context(), query, requester.ID, requester.ID)
	if err != nil {
		log.Printf("HandleGetInvitations: DB query error for user %s: %v", requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invitations"})
		return
	}
	defer rows.Close()

	invited := []gin.H{}
	invitees := []gin.H{}
	rowCount := 0
	for rows.Next() {
		rowCount++
		var friendshipCreatedAt string
		var user1, user2, inviter models.User
		err := rows.Scan(&friendshipCreatedAt,
			&user1.ID, &user1.Username, &user1.Email, &user1.CreatedAt, &user1.AvatarType, &user1.AvatarURL, &user1.Decoration,
			&user2.ID, &user2.Username, &user2.Email, &user2.CreatedAt, &user2.AvatarType, &user2.AvatarURL, &user2.Decoration,
			&inviter.ID, &inviter.Username, &inviter.Email, &inviter.CreatedAt, &inviter.AvatarType, &inviter.AvatarURL, &inviter.Decoration)
		if err != nil {
			log.Printf("HandleGetInvitations: error scanning row %d: %v", rowCount, err)
			continue
		}

		invitee := user1

		if user1.ID == requester.ID {
			invitee = user2
		}

		invitation := gin.H{
			"inviter":   inviter,
			"invitee":   invitee,
			"createdAt": friendshipCreatedAt,
		}

		if inviter.ID == requester.ID {
			invited = append(invited, invitation)
		} else {
			invitees = append(invitees, invitation)
		}
	}
	c.JSON(http.StatusOK, gin.H{"invited": invited, "invitee": invitees})
}

// Handler to accept a pending invitation
func HandleAcceptInvitation(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)
	otherID := c.Param("id")
	if otherID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	// Accept invitation regardless of user1/user2 order
	res, err := appCtx.DB.ExecContext(c.Request.Context(),
		"UPDATE friendships SET state = 'accepted', accepted_at = CURRENT_TIMESTAMP WHERE ((user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)) AND inviter_id != ? AND state = 'pending'",
		requester.ID, otherID, otherID, requester.ID, requester.ID)
	if err != nil {
		log.Printf("Error accepting invitation between %s and %s: %v", requester.ID, otherID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept invitation"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		log.Printf("No invitation found for %s and %s", otherID, requester.ID)
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "No pending invitation found"})
		return
	}

	go func() {
		achievementService := achievements.NewAchievementService(appCtx.DB, context.Background(), requester.ID)
		err := achievementService.UpdateFriendAchievements(requester.ID)
		if err != nil {
			log.Printf("Error updating friend achievements for %s: %v", requester.ID, err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Invitation accepted"})
}

// Handler to deny a pending invitation
func HandleDenyInvitation(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)
	otherID := c.Param("id")
	if otherID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}
	// Deny invitation regardless of user1/user2 order
	res, err := appCtx.DB.ExecContext(c.Request.Context(),
		"DELETE FROM friendships WHERE ((user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)) AND state = 'pending'",
		requester.ID, otherID, otherID, requester.ID)
	if err != nil {
		log.Printf("Error denying invitation between %s and %s: %v", requester.ID, otherID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to deny invitation"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		log.Printf("No invitation found between %s and %s: %v", requester.ID, otherID, err)
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "No pending invitation found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Invitation denied"})
}

// parseAvatarSlot reads a slot number, 0 up to (not including) queries.MaxAvatarSlots
func parseAvatarSlot(raw string) (int, bool) {
	slot, err := strconv.Atoi(raw)
	if err != nil || slot < 0 || slot >= queries.MaxAvatarSlots {
		return 0, false
	}
	return slot, true
}

// HandleGetMyAvatars lists the requester's drawn faces
func HandleGetMyAvatars(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	avatars, err := queries.GetUserAvatars(appCtx.DB, c.Request.Context(), requester.ID)
	if err != nil {
		log.Printf("Error getting avatars for %s: %v", requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to get your faces"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"avatars": avatars})
}

// HandleWearAvatar switches the requester to a face they've already drawn
func HandleWearAvatar(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	slot, ok := parseAvatarSlot(c.Param("slot"))
	if !ok {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "No such face slot"})
		return
	}

	err := queries.WearUserAvatar(appCtx.DB, c.Request.Context(), requester.ID, slot)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Nothing drawn in that slot yet"})
		return
	}
	if err != nil {
		log.Printf("Error wearing avatar slot %d for %s: %v", slot, requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to switch faces"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Switched faces"})
}

func HandleUpdateAvatarUrl(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)
	storageService := storage.NewStorageService(appCtx.Config)

	// Which of the slots to draw into; a redraw wipes what was there
	slot, ok := parseAvatarSlot(c.DefaultPostForm("slot", "0"))
	if !ok {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("No such face slot"))
		return
	}

	file, err := c.FormFile("image")
	if err != nil {
		log.Printf("Error getting image file for user %s: %v",
			utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("No image file provided"))
		return
	}

	buf, err := utils.ReadFileToBuffer(file)
	if err != nil {
		log.Printf("Error reading image file for user %s: %v",
			utils.MaskEmail(requester.Email), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to read image file"))
		return
	}

	var avatarURL string

	if appCtx.Config.Env != "development" {
		avatarURL, err = storageService.UploadProfilePicture(requester.ID, slot, buf)
		if err != nil {
			log.Printf("Error uploading profile picture for %s: %v", requester.ID, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload profile picture"})
			return
		}
	} else {
		// No S3 locally, so keep the drawing itself in the row
		avatarURL = "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf)
	}

	err = queries.SaveUserAvatar(appCtx.DB, c.Request.Context(), requester.ID, slot, avatarURL)
	if err != nil {
		log.Printf("Error updating profile picture for %s: %v", requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile picture"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully updated profile picture"})
}

func HandleToggleAvatarType(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	avatarType := "basic"

	if requester.AvatarType == "basic" {
		avatarType = "custom"
	}

	// Anyone can go back to initials; only switching to a drawn face needs the unlock
	if avatarType == "custom" {
		unlocked, err := queries.HasRewardUnlocked(appCtx.DB, c.Request.Context(), requester.ID, string(achievements.CUSTOM_PROFILE_PIC))
		if err != nil {
			log.Printf("Error checking custom face unlock for %s: %v", requester.ID, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile picture"})
			return
		}
		if !unlocked {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("You have not unlocked the required %s reward", achievements.CUSTOM_PROFILE_PIC)})
			return
		}
	}

	err := queries.UpdateUserAvatarType(appCtx.DB, c.Request.Context(), requester.ID, avatarType)

	if err != nil {
		log.Printf("Error updating avatar type to %s for %s: %v", avatarType, requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile picture"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Successfully toggles avatar type to %s for %s", avatarType, requester.ID)})
}

// HandleUpdateDecoration puts on one of the requester's unlocked decorations, or takes it off with ""
func HandleUpdateDecoration(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := requestContext.GetCtx(c)

	var body struct {
		Decoration string `json:"decoration"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if body.Decoration != "" {
		if !achievements.IsDecoration(achievements.RewardUnlockId(body.Decoration)) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Unknown decoration"})
			return
		}
		unlocked, err := queries.HasRewardUnlocked(appCtx.DB, c.Request.Context(), requester.ID, body.Decoration)
		if err != nil {
			log.Printf("Error checking decoration %s for %s: %v", body.Decoration, requester.ID, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update decoration"})
			return
		}
		if !unlocked {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You haven't unlocked that decoration yet"})
			return
		}
	}

	if err := queries.UpdateUserDecoration(appCtx.DB, c.Request.Context(), requester.ID, body.Decoration); err != nil {
		log.Printf("Error updating decoration to %q for %s: %v", body.Decoration, requester.ID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to update decoration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"decoration": body.Decoration})
}
