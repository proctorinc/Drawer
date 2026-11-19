package middleware

import (
	"crypto/rand"
	"crypto/rsa"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-jose/go-jose/v4"
	josejwt "github.com/go-jose/go-jose/v4/jwt"
	_ "github.com/mattn/go-sqlite3"
)

type clerkEmail struct {
	address string
	status  string
}

// fakeClerk serves the JWKS and Users endpoints of the Clerk Backend API and signs session tokens.
type fakeClerk struct {
	key    *rsa.PrivateKey
	emails map[string]clerkEmail // keyed by Clerk user ID
}

func newFakeClerk(t *testing.T) *fakeClerk {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeClerk{key: key, emails: map[string]clerkEmail{}}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/jwks":
			jwk := jose.JSONWebKey{Key: &key.PublicKey, KeyID: "test-key", Algorithm: "RS256", Use: "sig"}
			json.NewEncoder(w).Encode(map[string]any{"keys": []jose.JSONWebKey{jwk}})
		case strings.HasPrefix(r.URL.Path, "/users/"):
			id := strings.TrimPrefix(r.URL.Path, "/users/")
			email := f.emails[id]
			json.NewEncoder(w).Encode(map[string]any{
				"id":                       id,
				"primary_email_address_id": "idn_1",
				"email_addresses": []map[string]any{{
					"id":            "idn_1",
					"email_address": email.address,
					"verification":  map[string]any{"status": email.status},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	clerk.SetBackend(clerk.NewBackend(&clerk.BackendConfig{URL: clerk.String(srv.URL), Key: clerk.String("sk_test_fake")}))
	return f
}

func (f *fakeClerk) token(t *testing.T, clerkID string) string {
	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: f.key},
		(&jose.SignerOptions{}).WithHeader("kid", "test-key").WithType("JWT"),
	)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	token, err := josejwt.Signed(signer).Claims(josejwt.Claims{
		Subject:   clerkID,
		Issuer:    "https://clerk.drawer.test",
		IssuedAt:  josejwt.NewNumericDate(now),
		NotBefore: josejwt.NewNumericDate(now),
		Expiry:    josejwt.NewNumericDate(now.Add(time.Minute)),
	}).Serialize()
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func newTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })

	_, err = db.Exec(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			email TEXT UNIQUE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			role TEXT NOT NULL DEFAULT 'user',
			avatar_type TEXT NOT NULL DEFAULT 'basic',
			avatar_url TEXT NOT NULL DEFAULT '',
			decoration TEXT NOT NULL DEFAULT '',
			clerk_id TEXT
		);
		CREATE UNIQUE INDEX idx_users_clerk_id ON users (clerk_id);
		INSERT INTO users (id, username, email, role) VALUES
			('old-user', 'oldie', 'Old.User@Example.com', 'user'),
			('admin-user', 'boss', 'admin@example.com', 'admin');
	`)
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func newTestRouter(db *sql.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/me", ClerkSessionRequired(), AuthRequired(db), func(c *gin.Context) {
		if admin := GetImpersonator(c); admin != nil {
			c.Header("X-Impersonator", admin.ID)
		}
		c.String(http.StatusOK, GetUserID(c))
	})
	return router
}

func get(router *gin.Engine, token string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestAuthRequired(t *testing.T) {
	fake := newFakeClerk(t)
	fake.emails["user_old"] = clerkEmail{"old.user@example.com", "verified"}
	fake.emails["user_admin"] = clerkEmail{"admin@example.com", "verified"}
	fake.emails["user_new"] = clerkEmail{"new@example.com", "verified"}
	fake.emails["user_unverified"] = clerkEmail{"old.user@example.com", "unverified"}

	db := newTestDB(t)
	router := newTestRouter(db)

	t.Run("rejects requests without a session token", func(t *testing.T) {
		if w := get(router, ""); w.Code != http.StatusUnauthorized {
			t.Fatalf("got %d, want 401", w.Code)
		}
	})

	t.Run("rejects a token signed by another key", func(t *testing.T) {
		other := &fakeClerk{}
		other.key, _ = rsa.GenerateKey(rand.Reader, 2048)
		if w := get(router, other.token(t, "user_old")); w.Code != http.StatusUnauthorized {
			t.Fatalf("got %d, want 401", w.Code)
		}
	})

	t.Run("does not link an unverified email", func(t *testing.T) {
		if w := get(router, fake.token(t, "user_unverified")); w.Code == http.StatusOK {
			t.Fatalf("got 200 (%s), want an error", w.Body.String())
		}
	})

	t.Run("links an existing account by email, ignoring case", func(t *testing.T) {
		w := get(router, fake.token(t, "user_old"))
		if w.Code != http.StatusOK || w.Body.String() != "old-user" {
			t.Fatalf("got %d %q, want 200 old-user", w.Code, w.Body.String())
		}

		var clerkID string
		db.QueryRow(`SELECT clerk_id FROM users WHERE id = 'old-user'`).Scan(&clerkID)
		if clerkID != "user_old" {
			t.Fatalf("clerk_id = %q, want user_old", clerkID)
		}
	})

	t.Run("finds a linked account by Clerk ID", func(t *testing.T) {
		delete(fake.emails, "user_old") // proves the lookup no longer needs Clerk's API
		defer func() { fake.emails["user_old"] = clerkEmail{"old.user@example.com", "verified"} }()

		if w := get(router, fake.token(t, "user_old")); w.Body.String() != "old-user" {
			t.Fatalf("got %d %q, want old-user", w.Code, w.Body.String())
		}
	})

	t.Run("asks a new user to create a profile", func(t *testing.T) {
		w := get(router, fake.token(t, "user_new"))
		if w.Code != http.StatusNotFound || !strings.Contains(w.Body.String(), ProfileRequiredCode) {
			t.Fatalf("got %d %q, want 404 %s", w.Code, w.Body.String(), ProfileRequiredCode)
		}
	})

	impersonate := &http.Cookie{Name: ImpersonateCookie, Value: "old-user"}

	t.Run("lets an admin impersonate", func(t *testing.T) {
		w := get(router, fake.token(t, "user_admin"), impersonate)
		if w.Body.String() != "old-user" {
			t.Fatalf("got %d %q, want old-user", w.Code, w.Body.String())
		}
		if got := w.Header().Get("X-Impersonator"); got != "admin-user" {
			t.Fatalf("impersonator = %q, want admin-user", got)
		}
	})

	t.Run("has no impersonator without the cookie", func(t *testing.T) {
		if got := get(router, fake.token(t, "user_admin")).Header().Get("X-Impersonator"); got != "" {
			t.Fatalf("impersonator = %q, want none", got)
		}
	})

	t.Run("ignores the impersonation cookie for non-admins", func(t *testing.T) {
		cookie := &http.Cookie{Name: ImpersonateCookie, Value: "admin-user"}
		w := get(router, fake.token(t, "user_old"), cookie)
		if w.Body.String() != "old-user" {
			t.Fatalf("got %d %q, want old-user", w.Code, w.Body.String())
		}
		if got := w.Header().Get("X-Impersonator"); got != "" {
			t.Fatalf("impersonator = %q, want none", got)
		}
	})
}
