package reactions

import "testing"

func TestIsValid(t *testing.T) {
	for _, id := range []string{"heart", "cry-laugh", "face-meh", "fire", "goat"} {
		if !IsValid(id) {
			t.Errorf("IsValid(%q) = false, want true", id)
		}
	}
	for _, id := range []string{"", "not-a-reaction", "Heart", "snowflake", "gift"} {
		if IsValid(id) {
			t.Errorf("IsValid(%q) = true, want false", id)
		}
	}
}

func TestIsEventOnly(t *testing.T) {
	for _, id := range []string{"snowflake", "gift"} {
		if !IsEventOnly(id) {
			t.Errorf("IsEventOnly(%q) = false, want true", id)
		}
	}
	for _, id := range []string{"heart", "goat", "not-a-reaction"} {
		if IsEventOnly(id) {
			t.Errorf("IsEventOnly(%q) = true, want false", id)
		}
	}
}
