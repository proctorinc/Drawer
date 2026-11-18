// Package reactions holds the catalog of reactions people can leave on doodles and comments.
// reactions.json is shared with the frontend, which reads the labels, colors and images from it.
package reactions

import (
	_ "embed"
	"encoding/json"
)

//go:embed reactions.json
var catalogJSON []byte

var validIDs = func() map[string]bool {
	var catalog []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(catalogJSON, &catalog); err != nil {
		panic("reactions.json is invalid: " + err.Error())
	}
	ids := make(map[string]bool, len(catalog))
	for _, reaction := range catalog {
		ids[reaction.ID] = true
	}
	return ids
}()

// IsValid reports whether id is a reaction in the catalog
func IsValid(id string) bool {
	return validIDs[id]
}
