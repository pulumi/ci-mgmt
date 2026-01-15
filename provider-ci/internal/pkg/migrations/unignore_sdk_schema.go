package migrations

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// schema.go should not be ignored if it's part of the Go SDK.
type unignoreSDKSchemaGo struct{}

func (unignoreSDKSchemaGo) Name() string {
	return "Exclude sdk/go/**/schema.go from .gitignore"
}
func (unignoreSDKSchemaGo) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider" || templateName == "all"
}
func (unignoreSDKSchemaGo) Migrate(templateName, outDir string) error {
	gitignorePath := filepath.Join(outDir, ".gitignore")
	gitignore, err := os.ReadFile(gitignorePath)
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("error reading .gitignore: %w", err)
		}
		gitignore = []byte{}
	}
	gitignoreString := string(gitignore)
	if !strings.Contains(gitignoreString, "sdk/go/**/schema.go") {
		gitignoreString += "\n# Don't ignore schema.go if it's part of the Go SDK\n!sdk/go/**/schema.go\n"
		err := os.WriteFile(gitignorePath, []byte(gitignoreString), 0644)
		if err != nil {
			return fmt.Errorf("error writing to .gitignore: %w", err)
		}
		return err
	}
	return nil
}
