package models

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestUserJSONHidesEmail(t *testing.T) {
	user := User{ID: "u1", Username: "doodler", Email: "secret@example.com"}

	plain, err := json.Marshal(user)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(plain), "secret@example.com") {
		t.Errorf("a plain User leaked its email: %s", plain)
	}

	account, err := json.Marshal(user.Account())
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(account, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["email"] != "secret@example.com" || decoded["username"] != "doodler" {
		t.Errorf("an Account should carry the user and their email: %s", account)
	}
}
