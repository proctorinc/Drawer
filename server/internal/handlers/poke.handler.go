package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"drawer-service-backend/internal/notifications"
	"drawer-service-backend/internal/utils"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

const notificationTypePoke models.NotificationType = "poke"

// Each takes the poker's username
var pokeMessages = []string{
	"%s poked you. your page is looking awfully blank…",
	"%s is waiting on your masterpiece",
	"%s says: pencils up! today's doodle won't draw itself",
	"psst. %s wants to see what you draw today",
	"%s poked you. grab your colors, it's time.",
}

// HandlePokeFriend nudges a friend who hasn't drawn today, at most once per friend per day
func HandlePokeFriend(c *gin.Context) {
	appCtx := context.GetCtx(c)
	ctx := c.Request.Context()
	poker := middleware.GetUser(c)
	pokeeID := c.Param("id")

	areFriends, err := queries.AreFriends(appCtx.DB, ctx, poker.ID, pokeeID)
	if err != nil {
		log.Printf("HandlePokeFriend: checking friendship %s -> %s: %v", poker.ID, pokeeID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to poke"})
		return
	}
	if !areFriends {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "You can only poke friends"})
		return
	}

	hasDrawn, err := queries.CheckUserSubmittedToday(appCtx.DB, ctx, pokeeID)
	if err != nil {
		log.Printf("HandlePokeFriend: checking submission for %s: %v", pokeeID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to poke"})
		return
	}
	if hasDrawn {
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "They already drew today"})
		return
	}

	recorded, err := queries.RecordPoke(appCtx.DB, ctx, poker.ID, pokeeID, utils.GetFormattedDate(time.Now()))
	if err != nil {
		log.Printf("HandlePokeFriend: recording poke %s -> %s: %v", poker.ID, pokeeID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to poke"})
		return
	}
	if !recorded {
		c.AbortWithStatusJSON(http.StatusConflict, gin.H{"error": "Already poked today"})
		return
	}

	data := models.NotificationData{
		Type:     notificationTypePoke,
		Title:    "poke!",
		Body:     fmt.Sprintf(pokeMessages[rand.Intn(len(pokeMessages))], poker.Username),
		URL:      "/draw",
		UserID:   poker.ID,
		Username: poker.Username,
		Action:   "poked",
	}
	if err := notifications.SendNotificationToUser(appCtx.DB, pokeeID, data, appCtx.Config); err != nil {
		log.Printf("HandlePokeFriend: sending push to %s: %v", pokeeID, err)
	}

	c.Status(http.StatusNoContent)
}
