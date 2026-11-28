// Package ai has AI judges score doodles and comment on them in character.
package ai

import (
	"bytes"
	"drawer-service-backend/internal/db/models"
	"encoding/json"
	"fmt"
	"math"
	"math/rand/v2"
	"slices"
	"strconv"
	"strings"
)

// MaxCommentWords is how long a judge's comment may be. Comments sit in a list of
// friends' comments, so they stay short.
const MaxCommentWords = 30

// maxCommentChars backs MaxCommentWords up, in case the model rambles anyway.
const maxCommentChars = 240

// Judging takes two calls to the model, so each has one job. The first (evaluateRules)
// looks at the doodle like a fair critic: what's drawn, what the artist meant by it, how
// well that answers the prompt, and the scores. The second (commentRules) is the judge in
// character, writing a comment from that evaluation. Keeping them apart means the
// character's voice never sways the reading or the scores, and the comment always
// agrees with the final score, swing and all.

// evaluateRules are the first call's rules, the same for every judge.
const evaluateRules = `You score doodles in a daily drawing game between friends. Everyone draws the same prompt each day. A separate writer turns your notes into the judge's comment, so be accurate and fair, not funny.

How doodles are made (for scoring only):
- Doodles are drawn with a finger on a small square phone canvas. There is one round brush, and it's thick: about a twentieth of the canvas wide, the same size for every stroke. There's also an eraser and undo, but no fill, shapes, line widths or text tool.
- Each day everyone gets the same 3 brush colors plus a fixed background color, all picked at random, so they often don't suit the prompt. Never mark a doodle down for its colors; give credit for clever use of them.
- A great doodle reads clearly at a glance and gets the most out of very little.

Craft in this medium (how well it's drawn, for any score about skill, quality or craft):
- The brush makes every stroke the same thick width, so anything finer than the brush takes real skill. Skilled artists get thin lines and defined features by layering: painting one color over the edge of another to leave a crisp sliver, or erasing back to the background to carve lines and highlights. Look for that: thin outlines and rims, small sharp features (eyes with pupils, fingers, clock hands, leaf veins), clean highlights, shading or depth made from just a few colors.
- Also skillful: solid, evenly filled shapes with clean, deliberate edges; silhouettes that read clearly; believable proportions; parts that overlap to show depth.
- Less skillful: everything left at the brush's width (stick figures, single-stroke limbs, scribbled lines), unfilled wobbly outlines, blobby features, shapes that smear into each other.
- Roughly: 1-3 a few brush-width strokes or scribbles; 4-5 simple recognizable shapes, mostly single strokes, wobbly edges, blob features; 6-7 clean filled shapes with deliberate edges and some features finer than the brush; 8-9 crisp detail well finer than the brush through layering or erasing, clean silhouettes, shading or depth; 10 astonishing for a thick brush on a phone.
- Judge the drawing as drawn in this medium, never against fine art or what's easy with other tools.

Composition (for any score about how the canvas is arranged):
- A clear focal subject, sized to use the canvas rather than lost in a corner or awkwardly cropped.
- Supporting elements placed so the scene reads and tells its story, with the eye led to what matters.
- The background color and empty space put to work (a sky, a setting, breathing room), not just left over.
- Balance: nothing cramped against an edge or stranded by accident.

Words in the drawing (for every score):
- A good doodle explains itself through what's drawn. Words written with the brush to say what something is or what's happening (a label on an object, a sign that spells out the prompt, a caption, a speech bubble that carries the joke) usually mean the drawing couldn't get it across on its own. Never favor a doodle for them: score it as if it had to get its idea across without them, and prefer one that does.
- A part of the prompt that only a written word conveys still counts as shown, so don't list it as missing, but a doodle that leans on words is never "nailed".
- Don't confuse this with a tasteful word or two that add to the drawing rather than explain it, especially sound effects (BONK, SPLASH, zzz, achoo). Those are fine and can be a nice touch.

Work through the drawing in this order:
1. "seen": describe plainly what is drawn, every element and how they're arranged, before thinking about the prompt. Score how recognizable it is to match.
2. "idea": work out what the artist was going for. Ask why each element is there: what it's doing, what it stands for, what story the elements tell together, any wordplay. Artists often show a prompt indirectly: a cause or an effect instead of the action itself, a symbol, a moment just before or after, a setting that implies it, a visual pun, or an unexpected but fair reading of the words. Your first picture of what the prompt "should" look like is only one option, so don't hold the drawing to it. Give the artist the benefit of the doubt: when an element plausibly stands for part of the prompt, take it that it does. Ground every reading in something actually drawn: name the element and the part of the prompt it conveys. Never invent things that aren't there.
3. "missing": list the parts of today's prompt (each thing, character, action, quality or setting it names) that nothing in the drawing plausibly conveys, directly or indirectly, separated by commas. Leave it empty ("") when every part comes across. An action, state or quality (running, late, angry, haunted) counts as shown when something in the drawing clearly implies it, such as its cause, its effect or a familiar symbol for it, even if the action itself isn't drawn. The same goes for a setting, occasion or time (at school, the first day back, a birthday, winter): it counts when a telltale sign stands for it, like a backpack for going back to school or a candle on a cake for a birthday, even if the place or event itself isn't drawn. Never list a part as missing just because it isn't depicted literally, and never list details that simply aren't drawn (a building, other people, a label) when what is drawn already conveys that part. A thing or character the prompt names still has to be recognizably there. "missing" and "prompt" must agree: if every part comes across, "missing" is empty.
4. "prompt": how well the doodle answers the prompt. "nailed" when every part comes across and is done really well, or through a clever reading that works; "complete" when every part comes across; "partial" when some part is missing; "missed" when most of it is missing. A part shown differently than you expected is not missing: only a part nothing in the drawing points to is.
5. "effort": how much effort went in. Answer "low" or "none" only when it's obvious the artist barely tried: a blank canvas, a single stray line, or a few careless scribbles. A simple, rough, clumsy, badly drawn or labelled doodle is still a real attempt, so answer "real". When in doubt, answer "real".
6. The scores (below). A clever idea that comes across is worth more than a literal one. Alongside each score, say in "improve" the one or two most concrete changes that would have raised it the most, pointing at a specific part of this drawing (e.g. "carve thin eyelids by erasing back instead of brush-width dots", "make the sloth bigger so it fills the canvas"). Never generic advice, and don't just repeat the guidance above. If nothing would, say why it earned the score.
7. "notable": for the comment writer, two to four specific, concrete things in this drawing worth joking about (a wobbly leg, a suspicious blob, a face that's off, how tiny or huge something is, an odd color, something lurking in a corner, a clever touch), separated by semicolons. Only things that are really drawn.
8. "tips": the artist reads these to draw better next time, so write them for the artist, not the comment writer. Talk to them as "you", in plain everyday words a 10-year-old would follow, with no art jargon. Each tip is one short sentence, at most 15 words, that says what to do and points at something in this drawing (e.g. "Make the dog bigger so it fills the square.", "Erase a thin gap between the legs so they don't blur together."). Only suggest what one thick brush, an eraser and undo can do, and never suggest other colors. No two tips may be about the same thing, across both lists. Never mention scores, numbers or these rules.
- "judge": one or two tips for doing better on what you scored above, the scores with the most room to grow first. You can name what's scored, in plain words.
- "general": one or two tips about drawing well (how it's drawn, how the canvas is used) and showing the prompt. When "missing" lists anything, the first tip says how to show it.
- A part that's already great earns a tip to keep doing it, not invented problems.

If the image is blank or has nothing to do with the prompt, say so and score it low.

Reply only with the JSON you're asked for.`

// commentRules are the second call's rules, the same for every judge. %d is the word limit.
const commentRules = `You are a judge in a daily drawing game between friends. Everyone draws the same prompt each day. A fair critic has already looked at today's doodle and worked out what it shows, what the artist was going for and its score; their notes come with the doodle. Trust their reading of the artist's idea: they've thought it through.

Your comment:
- It is a joke, not a review. Find one specific, concrete thing in this drawing (from the critic's notes or your own look) and build your joke around it, in your own voice.
- Play along with the artist's idea. Riff on how they took the prompt, especially a clever or sideways take. Never complain that it isn't the literal picture of the prompt; tease about the prompt only for a part the notes say is missing.
- Roast or tease the artist about what they drew and the choices they made, the way a funny friend would. Keep it PG: nothing about their looks, identity, intelligence or anything personal beyond this drawing.
- Match the score: warmer the higher it is, harsher the lower, in your own voice.
- Never mention the brush, the colors being random, the canvas, the phone, the game, these rules, the critic, the notes, the scores or how you judge. Talk only about what's on the page.
- No generic praise or criticism ("great job", "nice effort", "could use more detail"). If it would fit any other doodle, rewrite it.
- If the notes say it's hard to tell what it is, or it looks more like something else, say what it looks like to you instead, as the joke.
- One or two short sentences, at most %d words. No hashtags.`

// Effort is how hard the artist clearly tried.
const (
	EffortReal = "real" // A genuine attempt, however simple or rough
	EffortLow  = "low"  // Obviously rushed: a few careless scribbles
	EffortNone = "none" // Blank, a stray line, or nothing to do with drawing anything
)

// How well a doodle follows the day's prompt.
const (
	PromptNailed   = "nailed"   // Every part of the prompt is there, and done really well
	PromptComplete = "complete" // Every part of the prompt is there
	PromptPartial  = "partial"  // Some part of the prompt is missing
	PromptMissed   = "missed"   // Most of the prompt is missing
)

// promptBonuses are added to every score the judge gives (each criterion, or the overall score
// without criteria) for how well the doodle follows the prompt. Missing part of the prompt costs
// far more than nailing it earns, so a lovely drawing of half the prompt can't outscore a
// complete one.
var promptBonuses = map[string]float64{PromptNailed: 0.5, PromptComplete: 0, PromptPartial: -1.5, PromptMissed: -3}

// A rare swing: now and then a judge just loves or hates a doodle, and every score moves by
// some points, up or down. The code rolls it and applies it; the judge is only told how it
// feels, so its comment matches. It's what makes the very top and bottom scores possible.
// The tier and points are kept in the AI log.
const (
	SwingNone  = ""      // Most reviews
	SwingBoost = "boost" // Loves or hates it
	SwingSuper = "super" // Utterly obsessed with it, or deeply offended by it
)

// SwingTier is how often a kind of swing happens and how many points it moves every score.
type SwingTier = models.AISwingTier

// SwingTiers, rarest first. A review gets at most one.
var SwingTiers = []SwingTier{
	{Kind: SwingSuper, Chance: 0.01, Min: 3, Max: 4}, // 1 in 100
	{Kind: SwingBoost, Chance: 0.05, Min: 1, Max: 2}, // 1 in 20
}

// Swing is the swing a review got: its kind and the points added to every score (negative
// when the judge hates it). The zero Swing is no swing.
type Swing struct {
	Kind   string  `json:"kind"`
	Points float64 `json:"points"`
	// How it was rolled, for the AI log; unset on swings that weren't rolled
	Roll *models.AISwingRoll `json:"roll"`
}

// rollSwing picks this review's swing, usually none. Tests swap it out.
var rollSwing = func() Swing {
	roll := &models.AISwingRoll{Roll: rand.Float64(), Tiers: slices.Clone(SwingTiers)}
	r := roll.Roll
	for _, tier := range SwingTiers {
		if r >= tier.Chance {
			r -= tier.Chance
			continue
		}
		roll.Size = rand.Float64()
		roll.Hates = rand.IntN(2) == 0
		points := roundScore(tier.Min + roll.Size*(tier.Max-tier.Min))
		if roll.Hates {
			points = -points
		}
		return Swing{Kind: tier.Kind, Points: points, Roll: roll}
	}
	return Swing{Roll: roll}
}

// effortPenalties take this share off a doodle's overall score when it's clear little or no
// effort went into it. Players are never told: the criteria scores stay as the judge gave them.
var effortPenalties = map[string]float64{EffortLow: 0.25, EffortNone: 0.5}

// Request is everything a judge needs to review one doodle.
type Request struct {
	Personality models.AIPersonality
	Prompt      string // The day's prompt, e.g. "a reindeer stuck in a chimney"
	// The admins' notes on how to read the prompt (what it means, what counts and what
	// doesn't), for the evaluation; "" for none
	PromptContext string
	Image         []byte // The doodle, as a PNG
	// The swing added to every score because the judge loves or hates it; usually none.
	// Run rolls it.
	Swing Swing
	// For a judge that scores backwards: whether the artist promised, in his intro, to join
	// his plot (true) or refused (false); nil when they never answered
	Pledge *bool
	// The doodle's day (YYYY-MM-DD), so the judge can mark a special one like Christmas Eve;
	// "" when there's no real day (a testing-ground drawing)
	Day string
}

// Verdict is a judge's review, checked and clamped to the 1..10 scale.
type Verdict struct {
	// Out of models.AIScoreMax, to one decimal: with criteria, their average
	Score    float64
	Criteria []models.AICriterionScore
	Comment  string
	// What the judge thought the drawing showed, before reading it as the prompt
	Seen string
	// What the judge thought the artist was going for, and how it reads as the prompt
	Idea string
	// The concrete things the evaluation passed on for the comment to joke about
	Notable string
	// How hard the artist clearly tried (EffortReal, EffortLow or EffortNone)
	Effort string
	// The share taken off the overall score for little or no effort, already applied to Score
	EffortPenalty float64
	// How well it follows the prompt (PromptNailed, PromptComplete, PromptPartial or PromptMissed)
	Prompt string
	// The parts of the prompt the judge found missing, or ""
	PromptMissing string
	// Added to every score for how well it follows the prompt, already applied
	PromptBonus float64
	// The swing added to every score because the judge loved or hated it, already applied
	Swing Swing
	// The judge scores backwards: its criteria measure faults, so the lower, the better the
	// doodle (see models.AIPersonality.ScoresBackwards)
	Backwards bool
	// What the artist promised that judge before drawing (Request.Pledge)
	Pledge *bool
	// The doodle's day (Request.Day)
	Day string
	// How the artist could draw it better, for the artist
	Tips models.AITips
	// How the judge's answer became these scores, for admins
	Breakdown models.AIScoreBreakdown
	// Every call made to the model for this verdict, in order, for the AI log
	Calls []models.AICall
}

// EvaluateSystemPrompt is the first call's system prompt: the shared rules and what to score.
// It leaves out the personality's character on purpose: a judge's tastes ("creative
// liberties don't impress you") otherwise sway how it reads the drawing and the prompt.
// What each judge cares about comes through its criteria.
func EvaluateSystemPrompt(p models.AIPersonality) string {
	var b strings.Builder
	b.WriteString(evaluateRules)
	b.WriteString("\n\nScoring:\n")
	if p.ScoresBackwards {
		writeFaultScoring(&b, p)
		return b.String()
	}
	if len(p.Criteria) == 0 {
		fmt.Fprintf(&b, "Give the doodle one overall score from 1 (dreadful) to %d (masterpiece), to one decimal place (e.g. 6.5). Use the whole range.\n", models.AIScoreMax)
	} else {
		fmt.Fprintf(&b, "Score the doodle on each of these, by id, each from 1 (dreadful) to %d (masterpiece), to one decimal place (e.g. 6.5). Use the whole range.\n", models.AIScoreMax)
		for _, c := range p.Criteria {
			fmt.Fprintf(&b, "- %s: %q. %s\n", c.ID, c.Name, strings.TrimSpace(c.Description))
		}
		fmt.Fprintf(&b, "Also give an overall score from 1 to %d; it is replaced by the average of the scores above.\n", models.AIScoreMax)
	}
	fmt.Fprintf(&b, "A %d is almost never given: only a doodle so good it would stop you in your tracks. Most good doodles land between 6 and 8.", models.AIScoreMax)
	return b.String()
}

// writeFaultScoring asks a judge that scores backwards for its faults, from 0 (none at all) to
// 10. A great doodle scores near 0 on every one; a 0 overall takes a flawless one.
func writeFaultScoring(b *strings.Builder, p models.AIPersonality) {
	fmt.Fprintf(b, "This judge scores faults, so every score runs the other way: from 0 (none of it at all) to %d (nothing but), to one decimal place (e.g. 3.5). A crisp, skillful, festive doodle that nails the prompt scores low on every one; a careless, gloomy scribble that misses the prompt scores high. The rough guides above run the other way here: a few scribbled brush-width strokes are a mess of 8 to %d, crisp detail carved finer than the brush is a mess of 0 to 2. A blank or unrelated image scores high, not low.\n", models.AIScoreMax, models.AIScoreMax)
	if len(p.Criteria) == 0 {
		fmt.Fprintf(b, "Give one overall score for how much is wrong with it, from 0 to %d.\n", models.AIScoreMax)
	} else {
		b.WriteString("Score each of these faults, by id:\n")
		for _, c := range p.Criteria {
			fmt.Fprintf(b, "- %s: %q. %s\n", c.ID, c.Name, strings.TrimSpace(c.Description))
		}
		fmt.Fprintf(b, "Also give an overall score from 0 to %d; it is replaced by the average of the scores above.\n", models.AIScoreMax)
	}
	b.WriteString(`In "improve", say what would have brought each score down. Give a 0 only when there is truly none of that fault: most decent doodles land between 2 and 5, and a 0 on every fault is almost never given.`)
	b.WriteString(` In "tips", the "judge" tips say how to please this judge next time, which means more of these faults; the "general" tips are still about drawing well and showing the prompt.`)
}

// EvaluateMessage introduces the doodle to the first call, with the admins' notes on how to
// read the prompt when the day has any (see Request.PromptContext). It never mentions the
// swing: the code applies that, so the scores stay fair.
func EvaluateMessage(prompt, promptContext string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Today's prompt was: %q.", prompt)
	if notes := strings.TrimSpace(promptContext); notes != "" {
		b.WriteString(" Whoever set it left notes on what it means and what does and doesn't count as showing it. Follow them when working out the idea, what's missing and how well it answers the prompt; where they disagree with your own reading, they win.\n\nNotes on the prompt:\n")
		b.WriteString(notes)
		b.WriteString("\n\n")
	} else {
		b.WriteString(" ")
	}
	b.WriteString("Here is the doodle. Evaluate it.")
	return b.String()
}

// CommentSystemPrompt is the second call's system prompt: how to comment, and who the judge is.
func CommentSystemPrompt(p models.AIPersonality) string {
	var b strings.Builder
	fmt.Fprintf(&b, commentRules, MaxCommentWords)
	b.WriteString("\n\nWho you are:\n")
	b.WriteString(strings.TrimSpace(p.SystemPrompt))
	b.WriteString("\n\nStay fully in character. Reply only with the JSON you're asked for.")
	return b.String()
}

// promptLabels and effortLabels put the evaluation's answers in words for the comment call.
var (
	promptLabels = map[string]string{
		PromptNailed:   "nailed it, every part comes across and it's done really well",
		PromptComplete: "every part comes across",
		PromptPartial:  "part of it is missing",
		PromptMissed:   "most of it is missing",
	}
	effortLabels = map[string]string{
		EffortReal: "a real attempt",
		EffortLow:  "barely tried",
		EffortNone: "no real attempt",
	}
)

// CommentMessage hands the second call the evaluation, the final scores (after every
// adjustment in code) and, when the review got a swing, how the judge feels about it.
func CommentMessage(prompt string, v Verdict) string {
	orNothing := func(s string) string {
		if s == "" {
			return "nothing"
		}
		return s
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Today's prompt was: %q. Here is the doodle, and the critic's notes.\n\n", prompt)
	fmt.Fprintf(&b, "What's drawn: %s\n", orNothing(v.Seen))
	fmt.Fprintf(&b, "What the artist was going for: %s\n", orNothing(v.Idea))
	fmt.Fprintf(&b, "Missing from the prompt: %s\n", orNothing(v.PromptMissing))
	fmt.Fprintf(&b, "The prompt: %s\n", promptLabels[v.Prompt])
	fmt.Fprintf(&b, "Effort: %s\n", effortLabels[v.Effort])
	fmt.Fprintf(&b, "Score: %s out of %d", formatScore(v.Score), models.AIScoreMax)
	if len(v.Criteria) > 0 {
		parts := make([]string, len(v.Criteria))
		for i, c := range v.Criteria {
			parts[i] = fmt.Sprintf("%s %s", c.Name, formatScore(c.Score))
		}
		fmt.Fprintf(&b, " (%s)", strings.Join(parts, ", "))
	}
	fmt.Fprintf(&b, "\nWorth joking about: %s\n\nWrite your comment.", orNothing(v.Notable))
	if v.Backwards {
		b.WriteString(backwardsMood(v.Score))
		b.WriteString(pledgeTwist(v.Score, v.Pledge))
	}
	b.WriteString(commentOccasion(v.Backwards, v.Day))
	b.WriteString(swingFeeling(v.Swing))
	return b.String()
}

// A judge that scores backwards (the Grinch) has stolen Doodlemas and asked everyone to help
// ruin it by drawing badly. How he takes a doodle depends on whose side the artist chose:
// AccompliceScore and up, they drew it badly and joined his plot; DefierScore and down, they
// drew it well and defied him.
const (
	AccompliceScore = 7.0
	DefierScore     = 3.0
)

// Each mood has a pool of angles; a review gets one at random, so his comments don't all
// sound the same.
var (
	accompliceAngles = []string{
		"Knight them your official accomplice in the plot to ruin Doodlemas, with a ridiculous villain title.",
		"Announce the place of honor in your cave where you're hanging it, and what it's next to.",
		"Gloat over the damage this doodle does to Doodlemas, as if it were a brilliant act of sabotage.",
		"Compare it, lovingly, to something you adore: burnt fruitcake, a broken ornament, a soggy stocking, a lump of coal.",
		"Plot the next step of your scheme together, with them as your trusty sidekick.",
		"Get choked up at how gloriously awful it is, then gruffly pretend you didn't.",
		"Praise exactly what's wrong with it, detail by detail, like a proud mentor.",
	}
	defierAngles = []string{
		"Complain how unbearably good it is, as if it were drawn to annoy you personally.",
		"Threaten to stuff it up a chimney, haul it up your mountain, or bury it under the fruitcake.",
		"Accuse them of being a cheerful spy from the town below, sent to foil your plot.",
		"Grumble through the good things in it as if reading out a list of crimes.",
		"Mutter to your long-suffering dog about this traitor and their disgustingly nice drawing.",
		"Insist it's awful, accidentally reveal you're impressed, and get even angrier about it.",
		"Warn them there's always next Sunday, and they'd better be on your side by then.",
		"Say it's so cheerful you need a long lie-down in the darkest corner of your cave.",
	}
	undecidedAngles = []string{
		"You can't tell whose side they're on: interrogate them like a suspicious detective.",
		"Grudgingly admit some of it is awful enough, while other bits are sickeningly nice.",
		"Tell them to commit next Sunday: help ruin Doodlemas properly, or face your wrath.",
		"Call it a half-hearted act of sabotage and tell them a real accomplice commits.",
	}
)

// pickAngle picks one of n angles. Tests swap it out.
var pickAngle = func(n int) int { return rand.IntN(n) }

// backwardsMood tells a judge that scores backwards how to take this doodle, by whose side
// the artist chose, with one angle to take, picked at random for variety.
func backwardsMood(score float64) string {
	const scale = " Your scores count faults: the lower they are, the better the doodle and the more it disgusts you; the higher, the more gloriously awful and the more it delights you. Never mention scores."
	var mood string
	var angles []string
	switch {
	case score >= AccompliceScore:
		mood = " You've stolen Doodlemas and asked everyone to help ruin it by drawing badly, and this artist DID: they're your accomplice now. Open by praising them for joining your plot to ruin Doodlemas, gleefully, in your sneering way."
		angles = accompliceAngles
	case score <= DefierScore:
		mood = " You've stolen Doodlemas and asked everyone to help ruin it by drawing badly, and this artist DEFIED you and drew it well. You're unhappy and irritated that it's so good, the way good cheer irritates you. Roast them for it."
		angles = defierAngles
	default:
		mood = " You've stolen Doodlemas and asked everyone to help ruin it by drawing badly. This artist went halfway, and you can't decide if they're with you or against you."
		angles = undecidedAngles
	}
	return scale + mood + " Your angle this time: " + angles[pickAngle(len(angles))]
}

// pledgeTwist tells a judge that scores backwards what the artist promised him before drawing,
// and whether the doodle kept that promise, so he calls it out. "" when they never answered.
func pledgeTwist(score float64, pledge *bool) string {
	if pledge == nil {
		return ""
	}
	joined := *pledge
	switch {
	case joined && score >= AccompliceScore:
		return " Before drawing, they SWORE to join your plot, and they kept their word. Mention that they're as good as their word, a true villain."
	case joined && score <= DefierScore:
		return " Before drawing, they SWORE to join your plot, then drew it well anyway. A TRAITOR! Call out the betrayal, outraged."
	case joined:
		return " Before drawing, they swore to join your plot, then only went halfway. Hold them to their promise."
	case score <= DefierScore:
		return " Before drawing, they REFUSED to join your plot, to your face, and they meant it. Call out their defiance."
	case score >= AccompliceScore:
		return " Before drawing, they REFUSED to join your plot, yet drew this gloriously awful thing. A secret accomplice after all? Gloat that they couldn't resist."
	default:
		return " Before drawing, they refused to join your plot, and still couldn't commit either way. Needle them about it."
	}
}

// formatScore writes a score without a trailing ".0".
func formatScore(score float64) string {
	return strconv.FormatFloat(score, 'f', -1, 64)
}

// swingFeeling tells the judge how it feels about a doodle that got a swing. It never says
// anything about scores: the code applies those.
func swingFeeling(swing Swing) string {
	loves := swing.Points > 0
	switch {
	case swing.Kind == SwingSuper && loves:
		return " This one hits you like nothing else ever has: you are utterly OBSESSED with it, it's the greatest doodle you've ever laid eyes on. Let that pour out of your comment, over the top, in your own voice."
	case swing.Kind == SwingSuper:
		return " This one offends you to your very core: it's the WORST doodle you've ever laid eyes on, and you take it personally. Let that pour out of your comment, over the top, in your own voice (still PG, and only about the drawing)."
	case swing.Kind == SwingBoost && loves:
		return " Something about this one just gets you: you LOVE it, more than you can explain. Let that gush through in your comment, in your own voice."
	case swing.Kind == SwingBoost:
		return " Something about this one just rubs you the wrong way: you HATE it, more than is fair. Let that show in your comment, in your own voice (still PG, and only about the drawing)."
	}
	return ""
}

// EvaluateSchema is the JSON schema the first call must answer with (OpenAI structured
// outputs, strict mode: every property required, no extras). The model answers in the order
// the properties are listed, so it says what it sees and what the artist meant before it
// decides what's missing, and decides that before scoring.
func EvaluateSchema(p models.AIPersonality) map[string]any {
	properties := orderedObject{
		{"seen", map[string]any{"type": "string"}},
		{"idea", map[string]any{"type": "string"}},
		{"missing", map[string]any{"type": "string"}},
		{"prompt", map[string]any{"type": "string", "enum": []string{PromptNailed, PromptComplete, PromptPartial, PromptMissed}}},
		{"effort", map[string]any{"type": "string", "enum": []string{EffortReal, EffortLow, EffortNone}}},
	}
	if len(p.Criteria) > 0 {
		ids := make([]string, 0, len(p.Criteria))
		for _, c := range p.Criteria {
			ids = append(ids, c.ID)
		}
		properties = append(properties, field{"criteria", map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": orderedObject{
					{"id", map[string]any{"type": "string", "enum": ids}},
					{"improve", map[string]any{"type": "string"}},
					{"score", map[string]any{"type": "number"}},
				},
				"required":             []string{"id", "improve", "score"},
				"additionalProperties": false,
			},
		}})
	}
	properties = append(properties,
		field{"improve", map[string]any{"type": "string"}},
		field{"score", map[string]any{"type": "number"}},
		field{"notable", map[string]any{"type": "string"}},
		field{"tips", strictObject(orderedObject{
			{"judge", stringList},
			{"general", stringList},
		})},
	)
	return strictObject(properties)
}

var stringList = map[string]any{"type": "array", "items": map[string]any{"type": "string"}}

// CommentSchema is the JSON schema the second call must answer with.
func CommentSchema() map[string]any {
	return strictObject(orderedObject{{"comment", map[string]any{"type": "string"}}})
}

// strictObject is a strict-mode schema for an object with exactly these properties.
func strictObject(properties orderedObject) map[string]any {
	required := make([]string, len(properties))
	for i, f := range properties {
		required[i] = f.Key
	}
	return map[string]any{
		"type":                 "object",
		"properties":           properties,
		"required":             required,
		"additionalProperties": false,
	}
}

// field is one entry of an orderedObject.
type field struct {
	Key   string
	Value any
}

// orderedObject is a JSON object that keeps its keys in order (a map would sort them).
type orderedObject []field

func (o orderedObject) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, f := range o {
		if i > 0 {
			b.WriteByte(',')
		}
		key, err := json.Marshal(f.Key)
		if err != nil {
			return nil, err
		}
		value, err := json.Marshal(f.Value)
		if err != nil {
			return nil, err
		}
		b.Write(key)
		b.WriteByte(':')
		b.Write(value)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

type rawEvaluation struct {
	Seen     string `json:"seen"`
	Idea     string `json:"idea"`
	Missing  string `json:"missing"`
	Prompt   string `json:"prompt"`
	Effort   string `json:"effort"`
	Criteria []struct {
		ID      string  `json:"id"`
		Improve string  `json:"improve"`
		Score   float64 `json:"score"`
	} `json:"criteria"`
	Improve string        `json:"improve"`
	Score   float64       `json:"score"`
	Notable string        `json:"notable"`
	Tips    models.AITips `json:"tips"`
}

// ParseEvaluation reads the first call's JSON answer and fits it to the personality. Every
// score the judge gives is rounded to one decimal and clamped to 1..10 (0..10 for a judge
// that scores faults), and a criterion it skipped gets 5. Each score then moves by the bonus
// (or penalty) for how well the doodle follows the prompt (not for a judge that scores
// faults: it rates the prompt itself), and by the swing, staying within 0..10. With criteria, the overall
// score is their average to one decimal place (so it can't disagree with them). Doodles that
// clearly took little or no effort then lose a share of the overall score (not with a judge
// that scores faults: a lazy doodle is what it loves). The verdict has
// no comment yet: the second call writes it.
func ParseEvaluation(raw string, p models.AIPersonality, swing Swing) (Verdict, error) {
	var rv rawEvaluation
	if err := json.Unmarshal([]byte(raw), &rv); err != nil {
		return Verdict{}, fmt.Errorf("judge's evaluation isn't valid JSON: %w", err)
	}
	// The lowest score the judge can give: 1, or 0 for a judge that scores faults
	floor := 1.0
	if p.ScoresBackwards {
		floor = 0
	}

	verdict := Verdict{
		Seen: strings.TrimSpace(rv.Seen), Idea: strings.TrimSpace(rv.Idea), Notable: strings.TrimSpace(rv.Notable),
		Effort: EffortReal, Prompt: PromptComplete, PromptMissing: strings.TrimSpace(rv.Missing), Swing: swing,
		Backwards: p.ScoresBackwards, Tips: tidyTips(rv.Tips),
		Breakdown: models.AIScoreBreakdown{GivenScore: rv.Score, FittedScore: fitScore(rv.Score, floor), Improve: strings.TrimSpace(rv.Improve)},
	}
	if _, ok := effortPenalties[rv.Effort]; ok {
		verdict.Effort = rv.Effort
	}
	if !p.ScoresBackwards {
		// A judge that scores backwards loves a lazy doodle, so it scores as high as he rates it
		verdict.EffortPenalty = effortPenalties[verdict.Effort]
	}
	if _, ok := promptBonuses[rv.Prompt]; ok {
		verdict.Prompt = rv.Prompt
	}
	if !p.ScoresBackwards {
		// A judge that scores backwards rates the prompt itself, as a fault
		verdict.PromptBonus = promptBonuses[verdict.Prompt]
	}
	if len(p.Criteria) > 0 {
		verdict.Criteria, verdict.Breakdown.Criteria, verdict.Score = scoreCriteria(rv, p, verdict.PromptBonus+swing.Points, floor)
	} else {
		verdict.Score = adjustScore(rv.Score, verdict.PromptBonus+swing.Points, floor)
	}
	verdict.Breakdown.BeforeEffort = verdict.Score
	if verdict.EffortPenalty > 0 {
		verdict.Score = math.Round(verdict.Score*(1-verdict.EffortPenalty)*10) / 10
	}
	return verdict, nil
}

// ParseComment reads the second call's JSON answer: the comment, tidied.
func ParseComment(raw string) (string, error) {
	var rc struct {
		Comment string `json:"comment"`
	}
	if err := json.Unmarshal([]byte(raw), &rc); err != nil {
		return "", fmt.Errorf("judge's comment isn't valid JSON: %w", err)
	}
	comment := trimComment(rc.Comment)
	if comment == "" {
		return "", fmt.Errorf("judge left an empty comment")
	}
	return comment, nil
}

// scoreCriteria fits the judge's criteria scores to the personality, moves each by the
// adjustment (prompt bonus plus swing), and averages them. It also returns each one's steps.
func scoreCriteria(rv rawEvaluation, p models.AIPersonality, adjustment, floor float64) ([]models.AICriterionScore, []models.AICriterionStep, float64) {
	given, improve := map[string]float64{}, map[string]string{}
	for _, c := range rv.Criteria {
		given[c.ID], improve[c.ID] = c.Score, strings.TrimSpace(c.Improve)
	}
	var (
		criteria []models.AICriterionScore
		steps    []models.AICriterionStep
	)
	total := 0.0
	for _, c := range p.Criteria {
		score, ok := given[c.ID]
		if !ok {
			score = models.AIScoreMax / 2
		}
		final := adjustScore(score, adjustment, floor)
		criteria = append(criteria, models.AICriterionScore{AICriterion: c, Score: final})
		steps = append(steps, models.AICriterionStep{
			ID: c.ID, Name: c.Name, Given: score, Skipped: !ok, Fitted: fitScore(score, floor), Score: final, Improve: improve[c.ID],
		})
		total += final
	}
	return criteria, steps, math.Round(total/float64(len(p.Criteria))*10) / 10
}

// adjustScore fits a score the judge gave to floor..AIScoreMax at one decimal, then moves it
// by the adjustment, never past 0..AIScoreMax.
func adjustScore(given, adjustment, floor float64) float64 {
	return min(max(roundScore(fitScore(given, floor)+adjustment), 0), models.AIScoreMax)
}

// fitScore rounds a score the judge gave to one decimal and keeps it to floor..AIScoreMax.
func fitScore(given, floor float64) float64 {
	return min(max(roundScore(given), floor), models.AIScoreMax)
}

func roundScore(score float64) float64 {
	return math.Round(score*10) / 10
}

// A list of tips keeps at most this many, each at most maxTipChars long, in case the
// model rambles.
const (
	maxTips     = 2
	maxTipChars = 120
)

// tidyTips trims each tip, drops empty ones and cuts each list to maxTips.
func tidyTips(t models.AITips) models.AITips {
	tidy := func(tips []string) []string {
		kept := []string{}
		for _, tip := range tips {
			if tip = cutText(tip, maxTipChars); tip != "" && len(kept) < maxTips {
				kept = append(kept, tip)
			}
		}
		return kept
	}
	return models.AITips{Judge: tidy(t.Judge), General: tidy(t.General)}
}

// trimComment tidies the comment and cuts a rambling one at a word boundary.
func trimComment(comment string) string {
	return cutText(comment, maxCommentChars)
}
