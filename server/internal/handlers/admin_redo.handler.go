package handlers

import (
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/utils"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Most redos an admin can hand someone in one go
const maxRedosAtOnce = 10

// HandleAdminListRedos lists the newest redo grants, unused ones first.
func HandleAdminListRedos(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	grants, err := queries.ListRedoGrants(appCtx.DB, c.Request.Context(), 300)
	if err != nil {
		log.Printf("HandleAdminListRedos: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load redos"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"grants": grants})
}

// HandleAdminGrantRedos gives a player redos: for one day, or for any day they missed.
func HandleAdminGrantRedos(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	admin := middleware.GetUser(c)

	var body struct {
		UserID string  `json:"userId"`
		Day    *string `json:"day"`
		Note   string  `json:"note"`
		Count  int     `json:"count"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.UserID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Pick a player"))
		return
	}
	if body.Count == 0 {
		body.Count = 1
	}
	if body.Count < 1 || body.Count > maxRedosAtOnce {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Give between 1 and 10 redos"))
		return
	}
	if body.Day != nil {
		day := strings.TrimSpace(*body.Day)
		if day == "" {
			body.Day = nil
		} else if !isPastDay(day, utils.GetFormattedDate(time.Now())) {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error("A redo is for a day that's already over"))
			return
		} else {
			body.Day = &day
		}
	}
	if body.Day != nil {
		if _, err := queries.GetDailyPrompt(appCtx.DB, ctx, *body.Day); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error("There was no prompt that day"))
			return
		}
	}
	if _, err := queries.GetUserByID(appCtx.DB, ctx, body.UserID); err != nil {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No such player"))
		return
	}

	ids := []string{}
	for range body.Count {
		id, err := queries.CreateRedoGrant(appCtx.DB, ctx, body.UserID, body.Day, strings.TrimSpace(body.Note), admin.ID)
		if err != nil {
			log.Printf("HandleAdminGrantRedos: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't give the redo"))
			return
		}
		ids = append(ids, id)
	}
	c.JSON(http.StatusCreated, gin.H{"ids": ids})
}

// HandleAdminRevokeRedo takes back a redo that hasn't been used.
func HandleAdminRevokeRedo(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	revoked, err := queries.RevokeRedoGrant(appCtx.DB, c.Request.Context(), c.Param("id"))
	if err != nil {
		log.Printf("HandleAdminRevokeRedo: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't take the redo back"))
		return
	}
	if !revoked {
		c.AbortWithStatusJSON(http.StatusConflict, Error("That redo has been used or is gone"))
		return
	}
	c.Status(http.StatusNoContent)
}
