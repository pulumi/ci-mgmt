package migrations

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Need to create an initial mise.lock file
type createMiseLock struct{}

func (createMiseLock) Name() string {
	return "Create an initial mise.lock"
}
func (createMiseLock) ShouldRun(templateName string) bool {
	return true
}
func (createMiseLock) Migrate(templateName, outDir string) error {
	miseLockPath := filepath.Join(outDir, ".config", "mise.lock")
	_, err := os.Stat(miseLockPath)
	if err != nil && os.IsNotExist(err) {
		if _, err := os.Create(miseLockPath); err != nil {
			return fmt.Errorf("error creating mise.lock: %w", err)
		}
		pulumiVersion, goVersion, err := getVersions(outDir)
		if err != nil {
			return fmt.Errorf("error getting go version from go.mod: %w", err)
		}
		cmd := exec.Command("mise", "install")
		cmd.Dir = outDir
		cmd.Env = append(os.Environ(),
			fmt.Sprintf("PULUMI_VERSION=%s", pulumiVersion),
			fmt.Sprintf("GO_VERSION=%s", goVersion),
		)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("error running mise install: %w\nOutput: %s", err, string(output))
		}
	}

	return nil
}

func getVersions(outdir string) (string, string, error) {
	cmd := exec.Command("scripts/get-versions.sh")
	cmd.Dir = filepath.Join(outdir)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", "", err
	}
	res := strings.Split(string(output), "\n")

	var goVersion string
	var pulumiVersion string
	for _, val := range res {
		key, val, ok := strings.Cut(val, "=")
		if ok && key == "PULUMI_VERSION" {
			pulumiVersion = val
		}
		if ok && key == "GO_VERSION" {
			goVersion = val
		}
	}
	if goVersion == "" || pulumiVersion == "" {
		return "", "", fmt.Errorf("error getting versions: pulumiVersion=%s; goVersion=%s", pulumiVersion, goVersion)
	}

	return pulumiVersion, goVersion, nil
}
