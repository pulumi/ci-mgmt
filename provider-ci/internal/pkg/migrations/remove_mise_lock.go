package migrations

import (
	"fmt"
	"os"
	"path/filepath"
)

// Remove mise.lock file if present - we no longer generate lockfiles
type maintainMiseLock struct{}

func (maintainMiseLock) Name() string {
	return "Remove mise.lock"
}
func (maintainMiseLock) ShouldRun(templateName string) bool {
	return true
}
func (maintainMiseLock) Migrate(templateName, outDir string) error {
	miseLockPath := filepath.Join(outDir, ".config", "mise.lock")
	_, err := os.Stat(miseLockPath)
	if err == nil {
		// File exists, remove it
		if err := os.Remove(miseLockPath); err != nil {
			return fmt.Errorf("error removing mise.lock: %w", err)
		}
		fmt.Println("Removed mise.lock file")
	} else if !os.IsNotExist(err) {
		// Some other error occurred
		return fmt.Errorf("error checking mise.lock: %w", err)
	}
	// If the file doesn't exist, nothing to do

	return nil
}
