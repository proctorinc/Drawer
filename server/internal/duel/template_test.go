package duel

import (
	"strings"
	"testing"
)

// Every prompt in the bank lays out with all its keywords in place, none tacked on the end.
func TestTemplateCoversTheBank(t *testing.T) {
	for _, p := range prompts {
		segs := Template(p.Text, p.Keywords)
		blanks := 0
		for _, s := range segs {
			if s.Blank != nil {
				blanks++
			} else if strings.Contains(s.Text, "…") {
				t.Errorf("%q: a keyword isn't in the sentence: %+v", p.Text, segs)
			}
		}
		if blanks != len(p.Keywords) {
			t.Errorf("%q: %d blanks for %d keywords", p.Text, blanks, len(p.Keywords))
		}
	}
}

func TestTemplate(t *testing.T) {
	keywords := []string{"polar bear", "snowboarding", "ramp"}
	segs := Template("a snowboarding polar bear jumping a ramp", keywords)
	var got []string
	for _, s := range segs {
		if s.Blank != nil {
			got = append(got, "["+keywords[*s.Blank]+"]")
		} else {
			got = append(got, s.Text)
		}
	}
	if want := "a |[snowboarding]| |[polar bear]| jumping a |[ramp]"; strings.Join(got, "|") != want {
		t.Errorf("template = %q, want %q", strings.Join(got, "|"), want)
	}
	if segs[3].Words != 2 {
		t.Errorf("polar bear should take 2 words, got %d", segs[3].Words)
	}
	if s := FillTemplate(segs, []string{"white bear", "skiing", ""}); s != "a skiing white bear jumping a ___" {
		t.Errorf("filled = %q", s)
	}
	// An older prompt whose keyword isn't spelled out still gets its blank
	segs = Template("a goldfish bowl on a roller coaster", []string{"fishbowl", "roller coaster"})
	if last := segs[len(segs)-1]; last.Blank == nil || *last.Blank != 0 {
		t.Errorf("fishbowl should be a blank at the end: %+v", segs)
	}
}
