package middleware

import (
	"database/sql"
	"drawer-service-backend/internal/db/queries"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// BetaRequired lets in admins and the people they've added to the beta zone.
func BetaRequired(repo *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		ok, err := queries.HasBetaAccess(repo, c.Request.Context(), user)
		if err != nil {
			log.Printf("BetaRequired: checking %s: %v", user.ID, err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Couldn't check beta access"})
			return
		}
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "The beta zone isn't open to you yet"})
			return
		}
		c.Next()
	}
}
