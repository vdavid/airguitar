package checks

import "fmt"

// AllChecks contains all check definitions with their metadata.
// Dependencies define which checks must complete before this one runs.
var AllChecks = []CheckDefinition{
	{ID: "format", DisplayName: "oxfmt", Tech: "🎨 Frontend", Run: RunFormat},
	{ID: "eslint", Nickname: "lint", DisplayName: "eslint", Tech: "🎨 Frontend", DependsOn: []string{"format"}, Run: RunESLint},
	{ID: "typecheck", Nickname: "tsc", DisplayName: "tsc", Tech: "🎨 Frontend", DependsOn: []string{"format"}, Run: RunTypecheck},
	{ID: "vitest", Nickname: "test", DisplayName: "vitest", Tech: "🧪 Test", DependsOn: []string{"format"}, Run: RunVitest},
	{ID: "build", DisplayName: "vite build", Tech: "🎨 Frontend", DependsOn: []string{"typecheck"}, Run: RunBuild},
	{ID: "scripts-go-vet", Nickname: "go-vet", DisplayName: "go vet", Tech: "🐹 Go", Run: RunGoVet},
	{ID: "scripts-go-tests", Nickname: "go-tests", DisplayName: "go tests", Tech: "🐹 Go", DependsOn: []string{"scripts-go-vet"}, Run: RunGoTests},
}

// GetCheckByID returns a check definition by its ID or nickname.
func GetCheckByID(id string) *CheckDefinition {
	for i := range AllChecks {
		if AllChecks[i].ID == id || AllChecks[i].Nickname == id {
			return &AllChecks[i]
		}
	}
	return nil
}

// CLIName returns the name to display/accept in CLI (nickname if set, else ID).
func (c *CheckDefinition) CLIName() string {
	if c.Nickname != "" {
		return c.Nickname
	}
	return c.ID
}

// ValidateCheckNames checks for duplicate IDs/nicknames and returns an error if any are found.
// This should be called at startup to catch configuration mistakes early.
func ValidateCheckNames() error {
	seen := make(map[string]string) // maps name -> check ID that owns it

	for _, check := range AllChecks {
		// Check the ID
		if ownerID, exists := seen[check.ID]; exists {
			return fmt.Errorf("duplicate check name '%s': used by both '%s' and '%s'", check.ID, ownerID, check.ID)
		}
		seen[check.ID] = check.ID

		// Check the nickname if set
		if check.Nickname != "" {
			if ownerID, exists := seen[check.Nickname]; exists {
				return fmt.Errorf("duplicate check name '%s': nickname for '%s' conflicts with '%s'", check.Nickname, check.ID, ownerID)
			}
			seen[check.Nickname] = check.ID
		}
	}
	return nil
}

// GetChecksByTech returns all checks for a specific tech.
func GetChecksByTech(tech string) []CheckDefinition {
	var result []CheckDefinition
	for _, check := range AllChecks {
		if check.Tech == tech {
			result = append(result, check)
		}
	}
	return result
}

// FilterSlowChecks removes slow checks unless includeSlow is true.
func FilterSlowChecks(defs []CheckDefinition, includeSlow bool) []CheckDefinition {
	if includeSlow {
		return defs
	}
	var result []CheckDefinition
	for _, def := range defs {
		if !def.IsSlow {
			result = append(result, def)
		}
	}
	return result
}
