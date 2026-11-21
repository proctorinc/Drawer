package handlers

import (
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

const settingPencilSound = "pencil_sound"

// PencilSounds are the sounds the pencils can make, the first being the default.
var PencilSounds = []string{"pencil", "musical"}

// AppSettings are the app-wide choices admins make for everyone.
type AppSettings struct {
	PencilSound string `json:"pencilSound"`
}

func newAppSettings(values map[string]string) AppSettings {
	sound := values[settingPencilSound]
	if !isPencilSound(sound) {
		sound = PencilSounds[0]
	}
	return AppSettings{PencilSound: sound}
}

func isPencilSound(sound string) bool {
	for _, known := range PencilSounds {
		if sound == known {
			return true
		}
	}
	return false
}

func loadAppSettings(c *gin.Context) (AppSettings, bool) {
	appCtx := requestContext.GetCtx(c)
	values, err := queries.GetAppSettings(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("Error loading app settings: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load settings"))
		return AppSettings{}, false
	}
	return newAppSettings(values), true
}

// HandleGetAppSettings gives anyone signed in the app-wide settings.
func HandleGetAppSettings(c *gin.Context) {
	if settings, ok := loadAppSettings(c); ok {
		c.JSON(http.StatusOK, settings)
	}
}

// HandleAdminUpdateAppSettings saves the settings given, leaving the rest as they are.
func HandleAdminUpdateAppSettings(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)

	var body struct {
		PencilSound *string `json:"pencilSound"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid settings"))
		return
	}

	values := map[string]string{}
	if body.PencilSound != nil {
		if !isPencilSound(*body.PencilSound) {
			c.AbortWithStatusJSON(http.StatusBadRequest, Error("Unknown pencil sound"))
			return
		}
		values[settingPencilSound] = *body.PencilSound
	}

	if err := queries.SetAppSettings(appCtx.DB, c.Request.Context(), values); err != nil {
		log.Printf("Error saving app settings: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save settings"))
		return
	}
	if settings, ok := loadAppSettings(c); ok {
		c.JSON(http.StatusOK, settings)
	}
}
