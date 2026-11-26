package handlers

import (
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// HandleAdminListAIMentions lists the comments that @mention an AI judge, oldest first.
func HandleAdminListAIMentions(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	mentions, err := queries.ListAIMentions(appCtx.DB, c.Request.Context(), appCtx.Config)
	if err != nil {
		log.Printf("HandleAdminListAIMentions: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't load the mentions"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"mentions": mentions})
}

// HandleAdminCheckAIMention checks a mention off by hand.
func HandleAdminCheckAIMention(c *gin.Context) {
	commentID, ok := mentionCommentID(c)
	if !ok {
		return
	}
	appCtx := requestContext.GetCtx(c)
	err := queries.CheckAIMention(appCtx.DB, c.Request.Context(), commentID, middleware.GetUser(c).ID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, Error("No such comment"))
	case err != nil:
		log.Printf("HandleAdminCheckAIMention %d: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't check it off"))
	default:
		c.Status(http.StatusNoContent)
	}
}

// HandleAdminUncheckAIMention takes a hand check-off back.
func HandleAdminUncheckAIMention(c *gin.Context) {
	commentID, ok := mentionCommentID(c)
	if !ok {
		return
	}
	appCtx := requestContext.GetCtx(c)
	if err := queries.UncheckAIMention(appCtx.DB, c.Request.Context(), commentID); err != nil {
		log.Printf("HandleAdminUncheckAIMention %d: %v", commentID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Couldn't uncheck it"))
		return
	}
	c.Status(http.StatusNoContent)
}

// mentionCommentID reads the comment id from the path, answering 400 when it isn't one.
func mentionCommentID(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Bad comment id"))
		return 0, false
	}
	return id, true
}
