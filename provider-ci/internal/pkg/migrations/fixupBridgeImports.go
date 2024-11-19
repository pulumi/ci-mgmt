package migrations

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

//go:embed fixupBridgeImports.patch
var fixupBridgeImportsPatch string

type fixupBridgeImports struct{}

func (fixupBridgeImports) Name() string {
	return "Fixup Bridge Imports"
}
func (fixupBridgeImports) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider"
}
func (fixupBridgeImports) Migrate(templateName, outDir string) error {
	path, cleanup, err := writeTempFile("fixupBridgeImports.patch", fixupBridgeImportsPatch)
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

	// Find go.mod files and tidy them
	goModCmd := exec.Command("find", ".", "-name", "go.mod", "-not", "-path", "./upstream/*")
	goModCmd.Dir = outDir
	goModCmd.Stderr = os.Stderr
	goModOutput, err := goModCmd.Output()
	if err != nil {
		return fmt.Errorf("error finding go.mod files: %w\n%s", err, goModOutput)
	}

	goModPaths := strings.Split(string(goModOutput), "\n")
	for _, goModPath := range goModPaths {
		if goModPath == "" {
			continue
		}
		tidyCmd := exec.Command("go", "mod", "tidy")
		tidyCmd.Dir = filepath.Join(outDir, filepath.Dir(goModPath))
		tidyCmd.Stdout = os.Stdout
		tidyCmd.Stderr = os.Stderr
		err = tidyCmd.Run()
		if err != nil {
			return fmt.Errorf("error running go mod tidy: %w", err)
		}
	}

	// Find modified .go files and run gofumpt on them
	gitDiff := exec.Command("git", "diff", "--name-only")
	gitDiff.Dir = outDir
	gitDiffOutput, err := gitDiff.Output()
	if err != nil {
		return fmt.Errorf("error getting changed files: %w", err)
	}
	if len(gitDiffOutput) == 0 {
		return nil
	}

	diffLines := strings.Split(string(gitDiffOutput), "\n")
	modifiedGoFiles := []string{}
	for _, line := range diffLines {
		if strings.HasSuffix(line, ".go") {
			modifiedGoFiles = append(modifiedGoFiles, line)
		}
	}
	if len(modifiedGoFiles) == 0 {
		return nil
	}

	for _, file := range modifiedGoFiles {
		// Tidy each file twice to ensure that the file is formatted correctly
		for i := 0; i < 2; i++ {
			gofumptCmd := exec.Command("go", "run", "mvdan.cc/gofumpt@latest", "-w", file)
			gofumptCmd.Stdout = os.Stdout
			gofumptCmd.Stderr = os.Stderr
			gofumptCmd.Dir = outDir
			err = gofumptCmd.Run()
			if err != nil {
				return fmt.Errorf("error running gofumpt: %w", err)
			}
		}
	}
	return nil
}
