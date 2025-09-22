package migrations

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/contract"
)

type Migration interface {
	Name() string
	Migrate(templateName, outDir string) error
	ShouldRun(templateName string) bool
}

func Migrate(templateName, outDir string) error {
	migrations := []Migration{
		fixupBridgeImports{},
		removeExplicitSDKDependency{},
		ignoreMakeDir{},
		updateToDotnet8{},
		ignoreMiseLocal{},
		removeGoToolchain{},
		migrateMiseConfig{},
		createMiseLock{},
	}
	for i, migration := range migrations {
		if !migration.ShouldRun(templateName) {
			fmt.Printf("Migration %d: %s: skipped\n", i+1, migration.Name())
			continue
		}
		fmt.Printf("Migration %d: %s: running\n", i+1, migration.Name())
		err := migration.Migrate(templateName, outDir)
		if err != nil {
			return fmt.Errorf("error running migration %q: %w", migration.Name(), err)
		}
	}
	return nil
}

// Returns the path to the temporary file and a function to clean it up, or an error.
func writeTempFile(name, content string) (string, func() error, error) {
	dir, err := os.MkdirTemp(os.TempDir(), "pulumi-provider-ci-migration-files")
	if err != nil {
		return "", nil, err
	}
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	if err != nil {
		return "", nil, err
	}
	defer contract.IgnoreError(f.Close)
	_, err = f.WriteString(content)
	return path, func() error { return os.Remove(f.Name()) }, err
}
