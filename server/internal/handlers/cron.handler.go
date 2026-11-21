package handlers

import (
	"crypto/subtle"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/duel"
	"drawer-service-backend/internal/notifications"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CronSecretHeader carries CRON_SECRET from the Cloud Scheduler job.
const CronSecretHeader = "X-Cron-Secret"

// HandleCronTick runs the timed jobs once: due event broadcasts, and duel reminders and
// expiry. Cloud Run only gives the server CPU while a request is in flight, so the
// in-process tickers stall on a quiet app; a scheduler hitting this keeps them on time.
// Both jobs claim each send first, so overlapping with a ticker never sends twice.
func HandleCronTick(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	secret := appCtx.Config.CronSecret
	if secret == "" {
		c.Status(http.StatusNotFound)
		return
	}
	if subtle.ConstantTimeCompare([]byte(c.GetHeader(CronSecretHeader)), []byte(secret)) != 1 {
		c.Status(http.StatusUnauthorized)
		return
	}

	ctx := c.Request.Context()
	err := errors.Join(
		notifications.RunEventNotifier(ctx, appCtx.Config, appCtx.DB),
		duel.RemindOrExpire(ctx, appCtx.DB, appCtx.Config, time.Now()),
	)
	if err != nil {
		log.Printf("cron tick: %v", err)
		c.Status(http.StatusInternalServerError)
		return
	}
	c.Status(http.StatusNoContent)
}
