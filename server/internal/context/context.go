package context

import (
	"database/sql"
	"drawer-service-backend/internal/config"

	"github.com/gin-gonic/gin"
)

type AppContext struct {
	DB      *sql.DB
	Config  *config.Config
}

var AppContextKey = "APP_CONTEXT"

func GetCtx(ctx *gin.Context) *AppContext {
	appContext := ctx.MustGet(string(AppContextKey)).(*AppContext)

	return appContext
}