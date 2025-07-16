package handlers

import (
	"drawer-service-backend/internal/middleware"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PushSubscriptionRequest struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func HandleSubscribePush(c *gin.Context) {
	db := middleware.GetDB(c)
	user := middleware.GetUser(c)

	var subReq PushSubscriptionRequest
	if err := c.ShouldBindJSON(&subReq); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	id := uuid.New().String()
	_, err := db.Exec(`INSERT OR REPLACE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, user.ID, subReq.Endpoint, subReq.Keys.P256dh, subReq.Keys.Auth, time.Now())
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	c.Status(http.StatusNoContent)
}

func HandleUnsubscribePush(c *gin.Context) {
	db := middleware.GetDB(c)
	user := middleware.GetUser(c)
	var req struct {
		Endpoint string `json:"endpoint"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	_, err := db.Exec(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`, user.ID, req.Endpoint)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	c.Status(http.StatusNoContent)
}
