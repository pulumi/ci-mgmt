package migrations

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type ignoreMakeDir struct{}

func (ignoreMakeDir) Name() string {
	return "Fixup Bridge Imports"
}
func (ignoreMakeDir) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider"
}
func (ignoreMakeDir) Migrate(templateName, outDir string) error {
	gitignorePath := filepath.Join(outDir, ".gitignore")
	gitignore, err := os.ReadFile(gitignorePath)
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("error reading .gitignore: %w", err)
		}
		gitignore = []byte{}
	}
	gitignoreString := string(gitignore)
	if !strings.Contains(gitignoreString, ".make") {
		gitignoreString += "\n\n# Ignore local build tracking directory\n.make\n"
		err := os.WriteFile(gitignorePath, []byte(gitignoreString), 0644)
		if err != nil {
			return fmt.Errorf("error writing to .gitignore: %w", err)
		}
		return err
	}
	return nil
}
