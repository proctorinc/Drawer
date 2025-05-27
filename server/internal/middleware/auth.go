package middleware

import (
	"database/sql"
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/utils"
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

var UserIDContextKey = "USER_ID"
var UserContextKey = "USER"

func AuthMiddleware(repo *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := c.Cookie("user_id")
		if err != nil {
			log.Println("Auth failed: Missing user_id cookie")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Missing user_id cookie"})
			return
		}
		if userID == "" {
			log.Println("Auth failed: Missing user_id cookie")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Missing user_id cookie"})
			return
		}

		user, err := db.GetUserFromDB(repo, c.Request.Context(), userID)

		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				log.Printf("Auth failed: User ID '%s' not found in database", userID)
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid user ID"})
			} else {
				log.Printf("Auth failed: Database error fetching user '%s': %v", userID, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error during authentication"})
			}
			return
		}

		// Add user info to the context
		c.Set(UserIDContextKey, user.ID)
		c.Set(UserContextKey, user)

		log.Printf("Auth successful for user: %s (%s)", user.ID, utils.MaskEmail(user.Email))
		c.Next()
	}
}

func GetUserID(ctx *gin.Context) string {
	return ctx.MustGet(UserIDContextKey).(string)
}

func GetUser(ctx *gin.Context) db.User {
	return ctx.MustGet(UserContextKey).(db.User)
}
