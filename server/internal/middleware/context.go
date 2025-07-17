package middleware

import (
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/context"

	"github.com/gin-gonic/gin"
)



func ContextMiddleware(cfg *config.Config, db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appCtx := &context.AppContext{
			DB:      db,
			Config:  cfg,
		}
		// Store the AppContext in the context
		c.Set(string(context.AppContextKey), appCtx)
		c.Next()
	}
}
