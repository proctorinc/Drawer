package notifications

import (
	"crypto/ecdh"
	"crypto/rand"
	"database/sql"
	"drawer-service-backend/internal/config"
	"drawer-service-backend/internal/db/models"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/SherClockHolmes/webpush-go"
	_ "github.com/mattn/go-sqlite3"
)

// browserKeys returns the p256dh and auth values a real browser subscription carries
func browserKeys(t *testing.T) (string, string) {
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	auth := make([]byte, 16)
	rand.Read(auth)
	enc := base64.RawURLEncoding
	return enc.EncodeToString(key.PublicKey().Bytes()), enc.EncodeToString(auth)
}

func TestSendNotificationToUser(t *testing.T) {
	pushService := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/gone":
			w.WriteHeader(http.StatusGone)
		case "/rejected":
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte("BadJwtToken"))
		default:
			w.WriteHeader(http.StatusCreated)
		}
	}))
	defer pushService.Close()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE push_subscriptions (id TEXT, user_id TEXT, endpoint TEXT UNIQUE, p256dh TEXT, auth TEXT, created_at TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/ok", "/gone", "/rejected"} {
		p256dh, auth := browserKeys(t)
		if _, err := db.Exec(`INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, 'ann', ?, ?, ?)`,
			path, pushService.URL+path, p256dh, auth); err != nil {
			t.Fatal(err)
		}
	}

	private, public, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{VAPIDPublicKey: public, VAPIDPrivateKey: private, VAPIDSubject: "https://example.com"}

	err = SendNotificationToUser(db, "ann", models.NotificationData{Title: "hi"}, cfg)
	if err == nil || !strings.Contains(err.Error(), "403") || strings.Contains(err.Error(), "410") {
		t.Errorf("want only the 403 reported, got %v", err)
	}

	var remaining []string
	rows, err := db.Query(`SELECT id FROM push_subscriptions ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		rows.Scan(&id)
		remaining = append(remaining, id)
	}
	if strings.Join(remaining, ",") != "/ok,/rejected" {
		t.Errorf("want the gone subscription deleted, remaining: %v", remaining)
	}
}

func TestSendNotificationToUserWithoutKeys(t *testing.T) {
	err := SendNotificationToUser(nil, "ann", models.NotificationData{}, &config.Config{})
	if err == nil || !strings.Contains(err.Error(), "VAPID") {
		t.Errorf("want a VAPID configuration error, got %v", err)
	}
}
