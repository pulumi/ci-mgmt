package migrations

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

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
	// JSON version output was introduced in v2.
	cmd := exec.Command("golangci-lint", "version", "--json")
	usingV2 := cmd.Run() == nil

	if !usingV2 {
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

	cmd = exec.Command("golangci-lint", "migrate")
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("Problem migrating golangci-lint config:\n%s\n%s\n", err, string(output))
		return nil
	}

	// Cleanup the backup config if all went well.
	return os.Remove(filepath.Join(cwd, ".golangci.bck.yml"))
}
