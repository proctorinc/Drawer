package handlers

import (
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// The stickers the app knows how to draw (src/stickers/stickers.ts)
var stickerKinds = map[string]bool{"bubble": true, "googly-eyes": true}

// How wide a sticker can start, as a percent of the canvas width
const (
	minStickerSize = 10
	maxStickerSize = 90
)

// How many letters admins can let a word bubble hold
const (
	minBubbleChars = 1
	maxBubbleChars = 32
)

// validateSticker reports what's wrong with a prompt's sticker, or "" if it's fine
func validateSticker(s models.Sticker) string {
	if !stickerKinds[s.Kind] {
		return "No such sticker"
	}
	if s.Size < minStickerSize || s.Size > maxStickerSize {
		return fmt.Sprintf("Sticker sizes must be %d to %d", minStickerSize, maxStickerSize)
	}
	if s.Kind == "bubble" && (s.MaxChars < minBubbleChars || s.MaxChars > maxBubbleChars) {
		return fmt.Sprintf("A word bubble holds %d to %d letters", minBubbleChars, maxBubbleChars)
	}
	if s.Kind != "bubble" && s.MaxChars != 0 {
		return "Only word bubbles hold letters"
	}
	return ""
}

// HandleAdminListStickers lists every prompt's sticker
func HandleAdminListStickers(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	stickers, err := queries.ListPromptStickers(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("Error listing prompt stickers: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load stickers"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"stickers": stickers})
}

// HandleAdminSetPromptSticker gives a day's prompt a sticker, in place of any it had
func HandleAdminSetPromptSticker(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	day := c.Param("day")

	var sticker models.Sticker
	if err := c.ShouldBindJSON(&sticker); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid request: "+err.Error()))
		return
	}
	if msg := validateSticker(sticker); msg != "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error(msg))
		return
	}

	err := queries.SetPromptSticker(appCtx.DB, c.Request.Context(), day, sticker)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error(day+" has no prompt yet"))
		return
	}
	if err != nil {
		log.Printf("Error setting the sticker for %s: %v", day, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to set the day's sticker"))
		return
	}
	c.JSON(http.StatusOK, queries.PromptSticker{Day: day, Sticker: sticker})
}

// HandleAdminRemovePromptSticker takes a day's sticker away
func HandleAdminRemovePromptSticker(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	day := c.Param("day")
	if err := queries.RemovePromptSticker(appCtx.DB, c.Request.Context(), day); err != nil {
		log.Printf("Error removing the sticker for %s: %v", day, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to remove the day's sticker"))
		return
	}
	c.Status(http.StatusNoContent)
}
