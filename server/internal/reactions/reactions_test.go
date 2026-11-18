package reactions

import "testing"

func TestIsValid(t *testing.T) {
	for _, id := range []string{"heart", "cry-laugh", "face-meh", "fire", "goat"} {
		if !IsValid(id) {
			t.Errorf("IsValid(%q) = false, want true", id)
		}
	}
	for _, id := range []string{"", "not-a-reaction", "Heart"} {
		if IsValid(id) {
			t.Errorf("IsValid(%q) = true, want false", id)
		}
	}
}
