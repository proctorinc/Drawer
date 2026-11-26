package handlers

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"regexp"

	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"

	"github.com/gin-gonic/gin"
)

// A sketch face: look/hair/neckline/glasses/extra. The app checks the parts
// themselves and falls back to the user's own face for any it doesn't know
var sketchFacePattern = regexp.MustCompile(`^[a-zA-Z]{1,20}(/[a-zA-Z]{1,20}){4}$`)

// HandleGetAvatarFaces lists the sketch faces admins picked, by user id
func HandleGetAvatarFaces(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	faces, err := queries.GetAvatarFaces(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("Error getting avatar faces: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to get avatar faces"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"faces": faces})
}

// HandleAdminGetUserAvatars lists a player's drawn faces
func HandleAdminGetUserAvatars(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	avatars, err := queries.GetUserAvatars(appCtx.DB, c.Request.Context(), c.Param("id"))
	if err != nil {
		log.Printf("Error getting avatars for %s: %v", c.Param("id"), err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to get their drawn faces"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"avatars": avatars})
}

// HandleAdminSetUserPicture swaps a player's profile picture: the drawn face
// they last wore (drawn), one in a slot (slot), a sketch face (face), or with
// none of those the sketch face their id gives them
func HandleAdminSetUserPicture(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	ctx := c.Request.Context()
	userID := c.Param("id")

	var body struct {
		Drawn bool   `json:"drawn"`
		Slot  *int   `json:"slot"`
		Face  string `json:"face"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Pick a picture"))
		return
	}
	user, err := queries.GetUserByID(appCtx.DB, ctx, userID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No such player"))
		return
	}

	switch {
	case body.Drawn:
		if user.AvatarURL == "" {
			c.AbortWithStatusJSON(http.StatusNotFound, Error("They haven't drawn a face"))
			return
		}
		err = queries.UpdateUserAvatarType(appCtx.DB, ctx, userID, "custom")
	case body.Slot != nil:
		err = queries.WearUserAvatar(appCtx.DB, ctx, userID, *body.Slot)
		if errors.Is(err, sql.ErrNoRows) {
			c.AbortWithStatusJSON(http.StatusNotFound, Error("They haven't drawn a face in that slot"))
			return
		}
	case body.Face == "" || sketchFacePattern.MatchString(body.Face):
		err = queries.WearAvatarFace(appCtx.DB, ctx, userID, body.Face)
	default:
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("That isn't a sketch face"))
		return
	}
	if err != nil {
		log.Printf("Error swapping the picture of %s: %v", userID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to swap their picture"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
