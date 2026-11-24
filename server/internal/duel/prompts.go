// Package duel runs sketch duels: two players take turns drawing a secret prompt in a
// minute while the other guesses it in three tries, with an AI scoring how much of the
// prompt's meaning each guess caught.
package duel

import (
	"math/rand"
	"strings"
)

// Prompt is something to draw, and the words a guess is scored on. Every keyword has to
// be drawable (no colors: the palette is three random ones), so a good drawing can earn
// all of them.
type Prompt struct {
	Text     string
	Keywords []string
}

// prompts are tricky on purpose: each mixes a few things that have to be drawn clearly
// for the guesser to get them all, like a round of pictionary.
var prompts = []Prompt{
	{"a snowman melting in a sauna", []string{"snowman", "melting", "sauna"}},
	{"a shark stuck in a bathtub", []string{"shark", "stuck", "bathtub"}},
	{"a robot walking a dog in the rain", []string{"robot", "walking", "dog", "rain"}},
	{"a giraffe wearing a scarf on a ski lift", []string{"giraffe", "scarf", "ski lift"}},
	{"an octopus juggling teacups", []string{"octopus", "juggling", "teacups"}},
	{"a cat sleeping on a laptop keyboard", []string{"cat", "sleeping", "laptop"}},
	{"a pirate ship sailing through a desert", []string{"pirate ship", "sailing", "desert"}},
	{"a ghost doing laundry", []string{"ghost", "laundry"}},
	{"a dinosaur blowing out birthday candles", []string{"dinosaur", "blowing out", "birthday", "candles"}},
	{"a penguin riding a skateboard downhill", []string{"penguin", "skateboard", "downhill"}},
	{"a wizard stuck in a traffic jam", []string{"wizard", "stuck", "traffic jam"}},
	{"an astronaut fishing on the moon", []string{"astronaut", "fishing", "moon"}},
	{"a frog king sitting on a lily pad throne", []string{"frog", "king", "lily pad", "throne"}},
	{"a vampire at the dentist", []string{"vampire", "dentist"}},
	{"a snail winning a race against a turtle", []string{"snail", "winning", "race", "turtle"}},
	{"a mermaid lost in a library", []string{"mermaid", "lost", "library"}},
	{"a bear hugging a beehive", []string{"bear", "hugging", "beehive"}},
	{"a knight fighting a giant spider", []string{"knight", "fighting", "giant", "spider"}},
	{"a whale carrying a lighthouse on its back", []string{"whale", "carrying", "lighthouse"}},
	{"a chef chasing a runaway pancake", []string{"chef", "chasing", "pancake"}},
	{"a sloth running a marathon", []string{"sloth", "running", "marathon"}},
	{"an owl reading a newspaper by candlelight", []string{"owl", "reading", "newspaper", "candle"}},
	{"a hamster driving a tiny car", []string{"hamster", "driving", "tiny", "car"}},
	{"a mummy taking a selfie", []string{"mummy", "selfie"}},
	{"a volcano erupting popcorn", []string{"volcano", "erupting", "popcorn"}},
	{"a tree house on top of a giraffe", []string{"tree house", "giraffe"}},
	{"a crab playing the drums", []string{"crab", "playing", "drums"}},
	{"a pig flying with a jetpack", []string{"pig", "flying", "jetpack"}},
	{"a skeleton walking a skeleton dog", []string{"skeleton", "walking", "dog"}},
	{"a cactus getting a hug", []string{"cactus", "hug"}},
	{"a lion getting a haircut", []string{"lion", "haircut"}},
	{"a mouse lifting a giant cheese", []string{"mouse", "lifting", "giant", "cheese"}},
	{"a dragon toasting marshmallows", []string{"dragon", "toasting", "marshmallows"}},
	{"a snowboarding polar bear jumping a ramp", []string{"polar bear", "snowboarding", "jumping", "ramp"}},
	{"a fish riding a bicycle underwater", []string{"fish", "bicycle", "underwater"}},
	{"a clock running late for a train", []string{"clock", "running", "late", "train"}},
	{"a kangaroo with a baby in a shopping cart", []string{"kangaroo", "baby", "shopping cart"}},
	{"a goldfish bowl on a roller coaster", []string{"goldfish bowl", "roller coaster"}},
	{"an alien mowing the lawn", []string{"alien", "mowing", "lawn"}},
	{"a squirrel hiding acorns in a mailbox", []string{"squirrel", "hiding", "acorns", "mailbox"}},
	{"a tortoise carrying a house on its shell", []string{"tortoise", "carrying", "house"}},
	{"a banana slipping on a person", []string{"banana", "slipping", "person"}},
	{"a monster hiding under the bed", []string{"monster", "hiding", "under", "bed"}},
	{"a chicken crossing a busy road", []string{"chicken", "crossing", "road"}},
	{"a duck in a top hat at the opera", []string{"duck", "top hat", "opera"}},
	{"a submarine in a teacup", []string{"submarine", "teacup"}},
	{"a caveman inventing the wheel", []string{"caveman", "inventing", "wheel"}},
	{"a spider knitting a sweater", []string{"spider", "knitting", "sweater"}},
	{"a hot air balloon tied to a turtle", []string{"hot air balloon", "tied", "turtle"}},
	{"a lighthouse in a snow globe", []string{"lighthouse", "snow globe"}},
	{"a bat hanging from a ceiling fan", []string{"bat", "hanging", "ceiling fan"}},
	{"an elephant hiding behind a lamppost", []string{"elephant", "hiding", "lamppost"}},
	{"a worm wearing a crown in an apple", []string{"worm", "crown", "apple"}},
	{"a raccoon raiding a picnic basket", []string{"raccoon", "raiding", "picnic basket"}},
	{"a ninja tiptoeing past a sleeping dog", []string{"ninja", "tiptoeing", "sleeping", "dog"}},
	{"a sunflower taller than a skyscraper", []string{"sunflower", "taller", "skyscraper"}},
	{"a mushroom house with a door and windows", []string{"mushroom", "house"}},
	{"a parrot talking on the phone", []string{"parrot", "talking", "phone"}},
	{"a horse doing yoga", []string{"horse", "yoga"}},
	{"a pizza parachuting from a plane", []string{"pizza", "parachute", "plane"}},
}

// PickPrompt chooses a prompt neither player has drawn or guessed before, if any are left.
func PickPrompt(used []string) Prompt {
	seen := map[string]bool{}
	for _, u := range used {
		seen[strings.ToLower(u)] = true
	}
	var fresh []Prompt
	for _, p := range prompts {
		if !seen[strings.ToLower(p.Text)] {
			fresh = append(fresh, p)
		}
	}
	if len(fresh) == 0 {
		fresh = prompts
	}
	return fresh[rand.Intn(len(fresh))]
}

// PromptCount is how many prompts are in the bank, for the admin page.
func PromptCount() int { return len(prompts) }
