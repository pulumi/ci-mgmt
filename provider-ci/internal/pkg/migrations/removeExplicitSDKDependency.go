package migrations

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
)

//go:embed removeExplicitSDKDependency.patch
var removeExplicitSDKDependencyPatch string

type removeExplicitSDKDependency struct{}

func (removeExplicitSDKDependency) Name() string {
	return "remove explicit SDK dependency"
}
func (removeExplicitSDKDependency) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider"
}
func (removeExplicitSDKDependency) Migrate(templateName, outDir string) error {
	path, cleanup, err := writeTempFile("removeExplicitSDKDependency.patch", removeExplicitSDKDependencyPatch)
	if err != nil {
		return fmt.Errorf("error writing patch file: %w", err)
	}
	defer cleanup()

	patchCmd := exec.Command("go", "run", "github.com/uber-go/gopatch@v0.4.0", "-p", path, "./provider/resources.go")
	patchCmd.Stdout = os.Stdout
	patchCmd.Stderr = os.Stderr
	patchCmd.Dir = outDir
	if err = patchCmd.Run(); err != nil {
		return fmt.Errorf("error running gopatch: %w", err)
	}

	// Tidy twice to ensure that the file is formatted correctly
	for i := 0; i < 2; i++ {
		gofumptCmd := exec.Command("go", "run", "mvdan.cc/gofumpt@latest", "-w", "./provider/resources.go")
		gofumptCmd.Stdout = os.Stdout
		gofumptCmd.Stderr = os.Stderr
		gofumptCmd.Dir = outDir
		err = gofumptCmd.Run()
		if err != nil {
			return fmt.Errorf("error running gofumpt: %w", err)
		}
	}
	return nil
}
