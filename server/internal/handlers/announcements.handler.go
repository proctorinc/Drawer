package handlers

import (
	"database/sql"
	requestContext "drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"errors"
	"log"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// HandleGetAnnouncements lists the announcements live right now, each marked with whether
// you've seen it. The app pops up the unseen ones and keeps the rest for reopening.
func HandleGetAnnouncements(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	list, err := queries.GetLiveAnnouncements(appCtx.DB, c.Request.Context(), middleware.GetUserID(c), time.Now())
	if err != nil {
		log.Printf("Error loading announcements: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to load announcements"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"announcements": list})
}

// HandleMarkAnnouncementsSeen records that you've seen these announcements, so they don't
// pop up on their own again.
func HandleMarkAnnouncementsSeen(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || len(body.IDs) == 0 || len(body.IDs) > 50 {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Send the ids of the announcements you saw"))
		return
	}
	if err := queries.MarkAnnouncementsSeen(appCtx.DB, c.Request.Context(), middleware.GetUserID(c), body.IDs); err != nil {
		log.Printf("Error marking announcements seen: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to mark announcements seen"))
		return
	}
	c.Status(http.StatusNoContent)
}

func HandleAdminListAnnouncements(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	list, err := queries.ListAnnouncements(appCtx.DB, c.Request.Context())
	if err != nil {
		log.Printf("Error listing announcements: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to list announcements"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"announcements": list})
}

func HandleAdminCreateAnnouncement(c *gin.Context) {
	saveAnnouncement(c, "")
}

func HandleAdminUpdateAnnouncement(c *gin.Context) {
	saveAnnouncement(c, c.Param("id"))
}

// AnnouncementInput is an announcement as the admin screen sends it.
type AnnouncementInput struct {
	Title     string `json:"title"`
	Body      string `json:"body"`
	Art       string `json:"art"`
	ImageURL  string `json:"imageUrl"`
	CTALabel  string `json:"ctaLabel"`
	CTAURL    string `json:"ctaUrl"`
	Position  int    `json:"position"`
	Active    bool   `json:"active"`
	StartsAt  string `json:"startsAt"`
	ExpiresAt string `json:"expiresAt"`
}

// ToAnnouncement checks the input and turns it into an announcement, or says what's wrong.
func (in AnnouncementInput) ToAnnouncement() (models.Announcement, error) {
	a := models.Announcement{
		Title:    strings.TrimSpace(in.Title),
		Body:     strings.TrimSpace(in.Body),
		Art:      in.Art,
		ImageURL: strings.TrimSpace(in.ImageURL),
		CTALabel: strings.TrimSpace(in.CTALabel),
		CTAURL:   strings.TrimSpace(in.CTAURL),
		Position: in.Position,
		Active:   in.Active,
	}
	if a.Art == "" {
		a.Art = models.AnnouncementArtNone
	}
	switch {
	case a.Title == "":
		return a, errors.New("Give it a title")
	case !slices.Contains(models.AnnouncementArts, a.Art):
		return a, errors.New("Unknown art " + a.Art)
	case a.Art == models.AnnouncementArtImage && a.ImageURL == "":
		return a, errors.New("Add an image URL, or pick other art")
	case (a.CTALabel == "") != (a.CTAURL == ""):
		return a, errors.New("A button needs both a label and a link")
	case a.CTAURL != "" && !strings.HasPrefix(a.CTAURL, "/") && !strings.HasPrefix(a.CTAURL, "https://"):
		return a, errors.New("The button's link must be an in-app path (/draw/…) or an https:// link")
	}
	var err error
	if a.StartsAt, err = time.Parse(time.RFC3339, in.StartsAt); err != nil {
		return a, errors.New("Invalid start time")
	}
	if a.ExpiresAt, err = time.Parse(time.RFC3339, in.ExpiresAt); err != nil {
		return a, errors.New("Invalid expiry time")
	}
	if !a.ExpiresAt.After(a.StartsAt) {
		return a, errors.New("It has to expire after it starts")
	}
	return a, nil
}

func saveAnnouncement(c *gin.Context, id string) {
	appCtx := requestContext.GetCtx(c)

	var input AnnouncementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error("Invalid announcement"))
		return
	}
	a, err := input.ToAnnouncement()
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, Error(err.Error()))
		return
	}
	a.ID = id

	saved, err := queries.SaveAnnouncement(appCtx.DB, c.Request.Context(), a)
	if errors.Is(err, sql.ErrNoRows) {
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Announcement not found"))
		return
	}
	if err != nil {
		log.Printf("Error saving announcement: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to save announcement"))
		return
	}
	status := http.StatusOK
	if id == "" {
		status = http.StatusCreated
	}
	c.JSON(status, saved)
}

func HandleAdminDeleteAnnouncement(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	err := queries.DeleteAnnouncement(appCtx.DB, c.Request.Context(), c.Param("id"))
	switch {
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, Error("Announcement not found"))
	case err != nil:
		log.Printf("Error deleting announcement: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to delete announcement"))
	default:
		c.Status(http.StatusNoContent)
	}
}

// HandleAdminResetAnnouncementViews makes an announcement pop up again for everyone.
func HandleAdminResetAnnouncementViews(c *gin.Context) {
	appCtx := requestContext.GetCtx(c)
	if err := queries.ResetAnnouncementViews(appCtx.DB, c.Request.Context(), c.Param("id")); err != nil {
		log.Printf("Error resetting announcement views: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Error("Failed to reset who's seen it"))
		return
	}
	c.Status(http.StatusNoContent)
}
