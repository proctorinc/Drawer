package handlers

import (
	"drawer-service-backend/internal/db"
	"drawer-service-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func prepareUserResponse(c *gin.Context, user *db.User) (db.GetMeResponse, error) {
	repo := middleware.GetDB(c)
	ctx := c.Request.Context()

	UserPrompts, err := db.GetUserSubmissionsFromDB(repo, ctx, user.ID)
	if err != nil {
		return db.GetMeResponse{}, err
	}

	UserPromptsFeed, err := db.GetUserAndFriendsSubmissionsFromDB(repo, ctx, user.ID)
	if err != nil {
		return db.GetMeResponse{}, err
	}

	friends, err := db.GetUserFriendsFromDB(repo, ctx, user.ID)
	if err != nil {
		return db.GetMeResponse{}, err
	}

	// Prepare the final response
	response := db.GetMeResponse{
		User:    *user,
		Prompts: UserPrompts,
		Feed:    UserPromptsFeed,
		Friends: friends,
	}

	return response, nil
}
