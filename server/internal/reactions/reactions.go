// Package reactions holds the catalog of reactions people can leave on doodles and comments.
// reactions.json is shared with the frontend, which reads the labels, colors and images from it.
package reactions

import (
	_ "embed"
	"encoding/json"
)

//go:embed reactions.json
var catalogJSON []byte

// validIDs are always allowed; eventIDs only while an event lists them
var validIDs, eventIDs = func() (map[string]bool, map[string]bool) {
	var catalog []struct {
		ID    string `json:"id"`
		Event bool   `json:"event"`
	}
	if err := json.Unmarshal(catalogJSON, &catalog); err != nil {
		panic("reactions.json is invalid: " + err.Error())
	}
	always := make(map[string]bool, len(catalog))
	event := map[string]bool{}
	for _, reaction := range catalog {
		if reaction.Event {
			event[reaction.ID] = true
		} else {
			always[reaction.ID] = true
		}
	}
	return always, event
}()

// IsValid reports whether id is an everyday reaction in the catalog
func IsValid(id string) bool {
	return validIDs[id]
}

// IsEventOnly reports whether id is a catalog reaction that only works while an event allows it
func IsEventOnly(id string) bool {
	return eventIDs[id]
}
