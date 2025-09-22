package migrations

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/mod/modfile"
)

// Remove any toolchain directive
type removeGoToolchain struct{}

func (removeGoToolchain) Name() string {
	return "Remove go toolchain directive"
}
func (removeGoToolchain) ShouldRun(templateName string) bool {
	return true
}
func (removeGoToolchain) Migrate(templateName, outDir string) error {
	// Locate go.mod, either at root or under provider/
	var modPath string
	if _, err := os.Stat(filepath.Join(outDir, "provider", "go.mod")); err == nil {
		modPath = filepath.Join(outDir, "provider", "go.mod")
	} else if _, err := os.Stat(filepath.Join(outDir, "go.mod")); err == nil {
		modPath = filepath.Join(outDir, "go.mod")
	} else {
		return fmt.Errorf("could not find go.mod file")
	}

	data, err := os.ReadFile(modPath)
	if err != nil {
		return err
	}

	f, err := modfile.Parse(modPath, data, nil)
	if err != nil {
		return err
	}

	if f.Toolchain == nil {
		return nil
	}
	// Clear the toolchain and reformat
	f.Toolchain = nil
	// Remove any toolchain stanza if present in syntax nodes
	// (Format will omit empty toolchain)
	out := modfile.Format(f.Syntax)

	if err := os.WriteFile(modPath, out, 0o644); err != nil {
		return err
	}

	return nil
}
