package migrations

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Always update the mise.lock file when we update ci-mgmt
type maintainMiseLock struct{}

func (maintainMiseLock) Name() string {
	return "Update mise.lock"
}
func (maintainMiseLock) ShouldRun(templateName string) bool {
	return true
}
func (maintainMiseLock) Migrate(templateName, outDir string) error {
	miseLockPath := filepath.Join(outDir, ".config", "mise.lock")
	_, err := os.Stat(miseLockPath)
	if os.IsNotExist(err) {
		if _, err := os.Create(miseLockPath); err != nil {
			return fmt.Errorf("error creating mise.lock: %w", err)
		}
	}
	pulumiVersion, goVersion, err := getVersions(outDir)
	if err != nil {
		return fmt.Errorf("error getting go version from go.mod: %w", err)
	}
	fmt.Printf("PULUMI_VERSION_MISE: %s\n", pulumiVersion)
	fmt.Printf("GO_VERSION_MISE: %s\n", goVersion)
	if err := runMiseCommand(pulumiVersion, goVersion, outDir, "install"); err != nil {
		return err
	}

	return nil
}

func runMiseCommand(pulumiVersion, goVersion, outDir string, args ...string) error {
	cmd := exec.Command("mise", args...)
	cmd.Dir = outDir
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("PULUMI_VERSION_MISE=%s", pulumiVersion),
		fmt.Sprintf("GO_VERSION_MISE=%s", goVersion),
	)
	output, err := cmd.CombinedOutput()
	fmt.Println(string(output))
	if err != nil {
		return fmt.Errorf("error running mise install: %w\nOutput: %s", err, string(output))
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
		if ok && key == "PULUMI_VERSION_MISE" {
			pulumiVersion = val
		}
		if ok && key == "GO_VERSION_MISE" {
			goVersion = val
		}
	}
	if goVersion == "" || pulumiVersion == "" {
		return "", "", fmt.Errorf("error getting versions: pulumiVersion=%s; goVersion=%s", pulumiVersion, goVersion)
	}

	return pulumiVersion, goVersion, nil
}
