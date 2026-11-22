package middleware

import (
	"context"
	"database/sql"
	"drawer-service-backend/internal/db/models"
	"drawer-service-backend/internal/db/queries"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/clerk/clerk-sdk-go/v2"
	clerkhttp "github.com/clerk/clerk-sdk-go/v2/http"
	clerkuser "github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/gin-gonic/gin"
)

var UserIDContextKey = "USER_ID"
var UserContextKey = "USER"

// ImpersonatorContextKey holds the admin behind the request while they impersonate someone.
var ImpersonatorContextKey = "IMPERSONATOR"

const ImpersonateCookie = "impersonate_user_id"

// ProfileRequiredCode tells the frontend the Clerk user is signed in but has
// no Drawer profile yet, so it should send them to pick a username.
const ProfileRequiredCode = "PROFILE_REQUIRED"

// ClerkSessionRequired verifies the Clerk session token in the Authorization header.
func ClerkSessionRequired() gin.HandlerFunc {
	verify := clerkhttp.WithHeaderAuthorization()

	return func(c *gin.Context) {
		verified := false
		verify(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			c.Request = r
			verified = true
		})).ServeHTTP(c.Writer, c.Request)

		if !verified {
			// The Clerk middleware has already written a 401
			c.Abort()
			return
		}

		if _, ok := clerk.SessionClaimsFromContext(c.Request.Context()); !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Missing session token"})
			return
		}

		c.Next()
	}
}

// devUserIDContextKey marks a request signed in by DevSession instead of Clerk.
var devUserIDContextKey = "DEV_USER_ID"

// DevSession stands in for ClerkSessionRequired when DEV_AUTH_BYPASS is on (development only),
// signing every request in as userID.
func DevSession(userID string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(devUserIDContextKey, userID)
		c.Next()
	}
}

// AuthRequired loads the Drawer user for the Clerk session. Must run after ClerkSessionRequired.
func AuthRequired(repo *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		var user *models.User
		var err error
		clerkID := ""
		if devID := c.GetString(devUserIDContextKey); devID != "" {
			user, err = queries.GetUserByID(repo, ctx, devID)
		} else {
			clerkID = GetClerkUserID(c)
			user, err = findOrLinkUser(repo, ctx, clerkID)
		}
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Profile not found", "code": ProfileRequiredCode})
			} else {
				log.Printf("Auth failed: error loading user for Clerk ID '%s': %v", clerkID, err)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Server error during authentication"})
			}
			return
		}

		if impersonatedID, err := c.Cookie(ImpersonateCookie); err == nil && impersonatedID != "" && user.Role == "admin" {
			impersonated, err := queries.GetUserByID(repo, ctx, impersonatedID)
			if err != nil {
				log.Printf("Impersonation failed: user '%s' not found: %v", impersonatedID, err)
			} else {
				c.Set(ImpersonatorContextKey, *user)
				user = impersonated
			}
		}

		c.Set(UserIDContextKey, user.ID)
		c.Set(UserContextKey, *user)

		c.Next()
	}
}

// findOrLinkUser returns the user linked to the Clerk account. On first sign-in, a
// pre-Clerk account is matched by verified email so existing users keep their data.
func findOrLinkUser(repo *sql.DB, ctx context.Context, clerkID string) (*models.User, error) {
	user, err := queries.GetUserByClerkID(repo, ctx, clerkID)
	if !errors.Is(err, sql.ErrNoRows) {
		return user, err
	}

	email, err := GetVerifiedClerkEmail(ctx, clerkID)
	if err != nil {
		return nil, err
	}

	user, err = queries.LinkClerkIDByEmail(repo, ctx, clerkID, email)
	if err == nil {
		log.Printf("Linked Clerk user %s to existing user %s", clerkID, user.ID)
	}
	return user, err
}

// GetVerifiedClerkEmail returns the Clerk user's primary email, if it has been verified.
func GetVerifiedClerkEmail(ctx context.Context, clerkID string) (string, error) {
	clerkUser, err := clerkuser.Get(ctx, clerkID)
	if err != nil {
		return "", fmt.Errorf("failed to fetch Clerk user: %w", err)
	}

	for _, email := range clerkUser.EmailAddresses {
		if clerkUser.PrimaryEmailAddressID == nil || email.ID != *clerkUser.PrimaryEmailAddressID {
			continue
		}
		if email.Verification == nil || email.Verification.Status != "verified" {
			return "", fmt.Errorf("primary email for Clerk user %s is not verified", clerkID)
		}
		return email.EmailAddress, nil
	}

	return "", fmt.Errorf("Clerk user %s has no primary email", clerkID)
}

func GetClerkUserID(ctx *gin.Context) string {
	claims, _ := clerk.SessionClaimsFromContext(ctx.Request.Context())
	return claims.Subject
}

func GetUserID(ctx *gin.Context) string {
	return ctx.MustGet(UserIDContextKey).(string)
}

func GetUser(ctx *gin.Context) models.User {
	return ctx.MustGet(UserContextKey).(models.User)
}

// GetImpersonator returns the admin impersonating the current user, or nil if nobody is.
func GetImpersonator(ctx *gin.Context) *models.User {
	if admin, ok := ctx.Get(ImpersonatorContextKey); ok {
		user := admin.(models.User)
		return &user
	}
	return nil
}
