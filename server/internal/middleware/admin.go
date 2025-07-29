package middleware

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// AdminMiddleware checks if the authenticated user has admin role
func AdminRequired(repo *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)

		// Check if user has admin role
		if user.Role != "admin" {
			log.Printf("Admin auth failed: User '%s' does not have admin role (has: %s)", user.ID, user.Role)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden: Admin access required"})
			return
		}

		c.Next()
	}
}
