package migrations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// runCmd executes a command and returns stdout and stderr separately.
// Both outputs are also formatted with [stdout] and [stderr] prefixes for logging.
func runCmd(cmd *exec.Cmd) (stdout, stderr string, err error) {
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	err = cmd.Run()
	stdout = outBuf.String()
	stderr = errBuf.String()
	return
}

// formatOutput returns a string with [stdout] and [stderr] prefixed lines.
func formatOutput(stdout, stderr string) string {
	var result strings.Builder

	if stdout != "" {
		scanner := strings.Split(stdout, "\n")
		for _, line := range scanner {
			if line != "" {
				result.WriteString("[stdout] ")
				result.WriteString(line)
				result.WriteString("\n")
			}
		}
	}

	if stderr != "" {
		scanner := strings.Split(stderr, "\n")
		for _, line := range scanner {
			if line != "" {
				result.WriteString("[stderr] ")
				result.WriteString(line)
				result.WriteString("\n")
			}
		}
	}

	return result.String()
}

// maintainGolangciConfig allows us to maintain provider lint configurations
// over time.
//
// Lint configuration is managed centrally in ci-mgmt, which is helpful for
// consistency but makes linter upgrades a lock-step process. Eventually we
// would like providers to have more flexibility with these central rules --
// either to adopt them at their own pace (in the case of long-tail providers)
// or to extend them with more stringent rules (in the case of higher-stakes
// providers).
//
// As a first step, this migration allows providers to opt-in to golangci-lint
// v2. We check whether whether v2 has been installed (via mise) and, if it is
// in use, the centrally managed config is automatically migrated to the v2
// format.
type maintainGolangciConfig struct{}

func (maintainGolangciConfig) Name() string {
	return "Maintain golangci-lint config"
}

func (maintainGolangciConfig) ShouldRun(_ string) bool {
	return true
}

func (maintainGolangciConfig) Migrate(_ string, cwd string) error {

	var parsed []struct {
		Version string
	}

	cmd := exec.Command("mise", "trust", "--yes")
	cmd.Dir = cwd
	stdout, stderr, err := runCmd(cmd)
	if err != nil {
		output := formatOutput(stdout, stderr)
		return fmt.Errorf("problem trusting: %w\n%s", err, output)
	}

	cmd = exec.Command("mise", "ls", "golangci-lint", "--json", "-c")
	cmd.Dir = cwd
	stdout, stderr, err = runCmd(cmd)
	if err != nil {
		output := formatOutput(stdout, stderr)
		return fmt.Errorf("problem getting golangci-lint version: %w\n%s", err, output)
	}

	err = json.NewDecoder(strings.NewReader(stdout)).Decode(&parsed)

	if err != nil || len(parsed) != 1 {
		output := formatOutput(stdout, stderr)
		return fmt.Errorf("parsing output: %w\n%s", err, output)
	}
	version := parsed[0].Version

	if strings.HasPrefix(version, "1") {
		fmt.Printf("Skipping: we are using golangci-lint %s\n", version)
		return nil

	}

	// If we have the binary available and it's using v2 then we need to check
	// the config.
	cfgPath := filepath.Join(cwd, ".golangci.yml")
	c, err := os.ReadFile(cfgPath)
	if err != nil {
		fmt.Printf("Skipping %q: %s\n", cfgPath, err)
		return nil
	}

	var cfg struct{ Version string }
	err = yaml.Unmarshal(c, &cfg)
	if err != nil {
		return fmt.Errorf("reading %q: %w", cfgPath, err)
	}

	if cfg.Version == "2" {
		return nil // Config was already migrated.
	}

	cmd = exec.Command("mise", "exec", "golangci-lint", "--", "golangci-lint", "migrate", "--verbose")
	cmd.Dir = cwd
	stdout, stderr, err = runCmd(cmd)

	if err != nil {
		output := formatOutput(stdout, stderr)
		fmt.Printf("Problem migrating golangci-lint config %s:\n%s\n%s\n", cfgPath, err, output)
		return nil
	}

	// Cleanup the backup config if all went well
	return os.Remove(filepath.Join(cwd, ".golangci.bck.yml"))
}
