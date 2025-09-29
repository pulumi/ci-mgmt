package migrations

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/contract"
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
	misePath := filepath.Join(outDir, ".config", "mise.toml")
	miseLockPath := filepath.Join(outDir, ".config", "mise.lock")
	_, err := os.Stat(miseLockPath)
	if !os.IsNotExist(err) {
		return nil
	}
	if _, err := os.Create(miseLockPath); err != nil {
		return fmt.Errorf("error creating mise.lock: %w", err)
	}
	pulumiVersion, goVersion, err := getVersions(outDir)
	if err != nil {
		return fmt.Errorf("error getting go version from go.mod: %w", err)
	}
	fmt.Printf("MISE_PULUMI_VERSION: %s\n", pulumiVersion)
	fmt.Printf("MISE_GO_VERSION: %s\n", goVersion)
	if err := runMiseCommand(pulumiVersion, goVersion, outDir, "install"); err != nil {
		return err
	}

	if err := copyFile(misePath, misePath+".bkp"); err != nil {
		return err
	}

	if err := runMiseCommand(pulumiVersion, goVersion, outDir, "use", fmt.Sprintf("go@%s", goVersion)); err != nil {
		return err
	}
	if err := runMiseCommand(pulumiVersion, goVersion, outDir, "use", fmt.Sprintf("pulumi@%s", pulumiVersion)); err != nil {
		return err
	}

	if err := copyFile(misePath+".bkp", misePath); err != nil {
		return err
	}

	if err := os.Remove(misePath + ".bkp"); err != nil {
		return err
	}

	return nil
}

func copyFile(srcPath, dstPath string) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer contract.IgnoreError(src.Close)

	dst, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer contract.IgnoreError(dst.Close)

	if _, err = io.Copy(dst, src); err != nil {
		return err
	}
	return dst.Sync()
}

func runMiseCommand(pulumiVersion, goVersion, outDir string, args ...string) error {
	cmd := exec.Command("mise", args...)
	cmd.Dir = outDir
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("MISE_PULUMI_VERSION=%s", pulumiVersion),
		fmt.Sprintf("MISE_GO_VERSION=%s", goVersion),
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
		if ok && key == "MISE_PULUMI_VERSION" {
			pulumiVersion = val
		}
		if ok && key == "MISE_GO_VERSION" {
			goVersion = val
		}
	}
	if goVersion == "" || pulumiVersion == "" {
		return "", "", fmt.Errorf("error getting versions: pulumiVersion=%s; goVersion=%s", pulumiVersion, goVersion)
	}

	return pulumiVersion, goVersion, nil
}
