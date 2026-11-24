package duel

import (
	"sort"
	"strings"
)

// Segment is one piece of a prompt laid out as a fill-in-the-blank sentence: either plain
// text the guesser always sees ("a ", " in a "), or a blank standing for one keyword.
type Segment struct {
	Text string `json:"text,omitempty"`
	// Which keyword this blank is (nil for plain text)
	Blank *int `json:"blank,omitempty"`
	// How many words the blank takes
	Words int `json:"words,omitempty"`
}

type span struct{ start, end, keyword int }

// promptWord is a word of the prompt and where it sits.
type promptWord struct {
	text       string
	start, end int
}

func wordsOf(text string) []promptWord {
	var out []promptWord
	start := -1
	for i, r := range text + " " {
		isWord := r == '\'' || (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')
		switch {
		case isWord && start < 0:
			start = i
		case !isWord && start >= 0:
			out = append(out, promptWord{strings.ToLower(text[start:i]), start, i})
			start = -1
		}
	}
	return out
}

// sameWord is loose on endings, so "candle" covers "candlelight" and "parachute" covers
// "parachuting".
func sameWord(a, b string) bool {
	if a == b || stem(a) == stem(b) {
		return true
	}
	shared := 0
	for shared < len(a) && shared < len(b) && a[shared] == b[shared] {
		shared++
	}
	return shared >= 4 && shared >= min(len(a), len(b))-2
}

// Template lays the prompt out as a sentence with a blank for each keyword. A keyword the
// prompt doesn't spell out (it can happen with older prompts) gets a blank at the end.
func Template(prompt string, keywords []string) []Segment {
	words := wordsOf(prompt)
	taken := make([]bool, len(words))
	var spans []span
	var unplaced []int

	for k, kw := range keywords {
		parts := wordsOf(kw)
		placed := false
		for i := 0; !placed && i+len(parts) <= len(words); i++ {
			match := len(parts) > 0
			for j, p := range parts {
				if taken[i+j] || !sameWord(words[i+j].text, p.text) {
					match = false
					break
				}
			}
			if match {
				for j := range parts {
					taken[i+j] = true
				}
				spans = append(spans, span{words[i].start, words[i+len(parts)-1].end, k})
				placed = true
			}
		}
		if !placed {
			unplaced = append(unplaced, k)
		}
	}
	sort.Slice(spans, func(a, b int) bool { return spans[a].start < spans[b].start })

	var out []Segment
	at := 0
	for _, s := range spans {
		if s.start > at {
			out = append(out, Segment{Text: prompt[at:s.start]})
		}
		out = append(out, blank(s.keyword, keywords))
		at = s.end
	}
	if at < len(prompt) {
		out = append(out, Segment{Text: prompt[at:]})
	}
	for _, k := range unplaced {
		out = append(out, Segment{Text: " … "}, blank(k, keywords))
	}
	return out
}

func blank(k int, keywords []string) Segment {
	i := k
	return Segment{Blank: &i, Words: max(1, len(strings.Fields(keywords[k])))}
}

// FillTemplate is the sentence with each blank filled by its answer.
func FillTemplate(segments []Segment, answers []string) string {
	var b strings.Builder
	for _, s := range segments {
		if s.Blank == nil {
			b.WriteString(s.Text)
			continue
		}
		answer := "___"
		if *s.Blank < len(answers) && strings.TrimSpace(answers[*s.Blank]) != "" {
			answer = strings.TrimSpace(answers[*s.Blank])
		}
		b.WriteString(answer)
	}
	return strings.Join(strings.Fields(b.String()), " ")
}
