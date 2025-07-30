package middleware

import (
	"database/sql"
	"drawer-service-backend/internal/achievements"
	"drawer-service-backend/internal/db/queries"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func RewardUnlockRequired(repo *sql.DB, rewardID achievements.RewardUnlockId) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)

		isUnlocked, err := queries.HasRewardUnlocked(repo, c.Request.Context(), user.ID, string(rewardID))

		if err != nil {
			log.Printf("Error checking reward unlock status: %v", err)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("You have not unlocked the required %s reward", rewardID)})
			return
		}

		if !isUnlocked {
			log.Printf("Required reward %s not unlocked for user %s", rewardID, user.ID)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("You have not unlocked the required %s reward", rewardID)})
			return
		}

		c.Next()
	}
}
