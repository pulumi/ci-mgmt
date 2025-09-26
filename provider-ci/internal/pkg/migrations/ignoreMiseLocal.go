package migrations

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// mise.local.toml is used for local config and should not be
// committed to source control. see https://mise.jdx.dev/configuration.html
type ignoreMiseLocal struct{}

func (ignoreMiseLocal) Name() string {
	return "Add mise.local.toml to .gitignore"
}
func (ignoreMiseLocal) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider" || templateName == "all"
}
func (ignoreMiseLocal) Migrate(templateName, outDir string) error {
	gitignorePath := filepath.Join(outDir, ".gitignore")
	gitignore, err := os.ReadFile(gitignorePath)
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("error reading .gitignore: %w", err)
		}
		gitignore = []byte{}
	}
	gitignoreString := string(gitignore)
	if !strings.Contains(gitignoreString, "mise.local.toml") {
		gitignoreString += "\n\n# Ignore local mise config\nmise.local.toml\n"
		err := os.WriteFile(gitignorePath, []byte(gitignoreString), 0644)
		if err != nil {
			return fmt.Errorf("error writing to .gitignore: %w", err)
		}
		return err
	}
	return nil
}
