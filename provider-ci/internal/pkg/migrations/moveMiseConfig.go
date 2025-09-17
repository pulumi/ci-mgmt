package migrations

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
)

// moving the mise.toml file to the `.config` directory.
// This allows users to override the file by placing a mise file
// at the root of the repo. see https://mise.jdx.dev/configuration.html
type moveMiseConfig struct{}

func (moveMiseConfig) Name() string {
	return "Move mise.toml to .config directory"
}
func (moveMiseConfig) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider"
}
func (moveMiseConfig) Migrate(templateName, outDir string) error {
	newPath := filepath.Join(outDir, ".config/mise.toml")
	oldPath := filepath.Join(outDir, "mise.toml")
	_, err := os.Stat(newPath)
	if err == nil {
		// new file already exists
		return nil
	}
	if os.IsNotExist(err) {
		err := os.Rename(oldPath, newPath)
		if err != nil {
			return fmt.Errorf("error moving mise.toml: %w", err)
		}
	}
	return nil
}
