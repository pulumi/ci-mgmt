package migrations

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// bin/mise is a committed bootstrap script that allows mise to be installed
// in environments where it is not already present (e.g. the Renovate CE container).
// If a repo's .gitignore excludes bin/, we add an explicit exception so
// bin/mise is tracked.
type allowBinMise struct{}

func (allowBinMise) Name() string {
	return "Allow bin/mise in .gitignore"
}
func (allowBinMise) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider" || templateName == "all"
}
func (allowBinMise) Migrate(templateName, outDir string) error {
	gitignorePath := filepath.Join(outDir, ".gitignore")
	gitignore, err := os.ReadFile(gitignorePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("error reading .gitignore: %w", err)
	}
	gitignoreString := string(gitignore)

	// Only add the exception if bin/ is already being ignored.
	binIgnored := strings.Contains(gitignoreString, "\nbin\n") ||
		strings.Contains(gitignoreString, "\nbin/\n") ||
		strings.HasPrefix(gitignoreString, "bin\n") ||
		strings.HasPrefix(gitignoreString, "bin/\n")
	if !binIgnored {
		return nil
	}

	if !strings.Contains(gitignoreString, "!bin/mise") {
		gitignoreString += "\n# Allow the committed mise bootstrap script\n!bin/mise\n"
		err := os.WriteFile(gitignorePath, []byte(gitignoreString), 0644)
		if err != nil {
			return fmt.Errorf("error writing to .gitignore: %w", err)
		}
	}
	return nil
}
