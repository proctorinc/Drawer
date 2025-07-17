package handlers

import (
	"drawer-service-backend/internal/context"
	"drawer-service-backend/internal/db/queries"
	"drawer-service-backend/internal/middleware"
	"net/http"

	"github.com/gin-gonic/gin"
)

type NotificationSubscriptionRequest struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func HandleSubscribePush(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := context.GetCtx(c)
	ctx := c.Request.Context()

	var subReq NotificationSubscriptionRequest
	if err := c.ShouldBindJSON(&subReq); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	err := queries.SubscribeUserToPushNotifications(appCtx.DB, ctx, queries.SubscribeUserToPushNotificationsParams{
		UserId:    requester.ID,
		Endpoint:  subReq.Endpoint,
		P256dhKey: subReq.Keys.P256dh,
		AuthKey:   subReq.Keys.Auth,
	})

	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Unable to subscribe to push notifications"})
		return
	}
	c.Status(http.StatusNoContent)
}

type NotificationUnsubscriptionRequest struct {
	Endpoint string `json:"endpoint"`
}

func HandleUnsubscribePush(c *gin.Context) {
	requester := middleware.GetUser(c)
	appCtx := context.GetCtx(c)
	ctx := c.Request.Context()

	var req NotificationUnsubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	err := queries.UnsubscribeUserFromPushNotifications(appCtx.DB, ctx, queries.UnsubscribeUserFromPushNotificationsParams{
		UserId:   requester.ID,
		Endpoint: req.Endpoint,
	})

	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Unable to unsubscribe from push notifications"})
		return
	}
	c.Status(http.StatusNoContent)
}
