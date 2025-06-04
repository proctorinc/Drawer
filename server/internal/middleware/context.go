package middleware

import (
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/storage"

	"github.com/gin-gonic/gin"
)

type AppContext struct {
	DB     *sql.DB
	Config *config.Config
	Storage *storage.StorageService
}

var AppContextKey = "APP_CONTEXT"

func ContextMiddleware(cfg *config.Config, db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		appCtx := &AppContext{
			DB:     db,
			Config: cfg,
		}
		// Store the AppContext in the context
		c.Set(string(AppContextKey), appCtx)
		c.Next()
	}
}


func GetConfig(ctx *gin.Context) *config.Config {
	appContext := ctx.MustGet(string(AppContextKey)).(*AppContext)

	return appContext.Config
}

func GetDB(ctx *gin.Context) *sql.DB {
	appContext := ctx.MustGet(string(AppContextKey)).(*AppContext)

	return appContext.DB
}

func GetStorageService(ctx *gin.Context) *storage.StorageService {
	appContext := ctx.MustGet(string(AppContextKey)).(*AppContext)

	return appContext.Storage
}