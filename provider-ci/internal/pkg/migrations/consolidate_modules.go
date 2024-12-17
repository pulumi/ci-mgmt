package migrations

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// consolidateModules moves ./provider/go.mod to the repository root (./go.mod)
// and consolidates it with ./examples/go.mod and ./tests/go.mod (if they
// exist). The SDK module is untouched, so SDK consumers are unaffected.
//
// The migration simplifies dependency management; eliminates the need for
// `replace` directives (except for shims); ensures consistent package
// versioning between provider logic and tests; makes it easier to share code;
// yields better IDE integration; and is all-around easier to work with.
//
// This was initially motivated by work to shard our integration tests. Our old
// module structure sometimes forced us to put integration tests alongside unit
// tests under ./provider. We also had integration tests under ./examples.
// Being able to shard both of those things concurrently (as part of a single
// `go test` command) wasn't possible due to them existing in separate modules.
//
// See also: https://go.dev/wiki/Modules#should-i-have-multiple-modules-in-a-single-repository
type consolidateModules struct{}

func (consolidateModules) Name() string {
	return "Consolidate Go modules"
}

func (consolidateModules) ShouldRun(_ string) bool {
	_, err := os.Stat("provider/go.mod")
	return err == nil // Exists.
}

func (consolidateModules) Migrate(_, outDir string) error {
	run := func(args ...string) ([]byte, error) {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = outDir
		cmd.Stderr = os.Stderr
		return cmd.Output()
	}

	// Move provider's module down.
	if _, err := run("git", "mv", "-f", "provider/go.mod", "go.mod"); err != nil {
		return fmt.Errorf("moving provider/go.mod: %w", err)
	}
	if _, err := run("git", "mv", "-f", "provider/go.sum", "go.sum"); err != nil {
		return fmt.Errorf("moving provider/go.sum: %w", err)
	}

	// Load the module as JSON.
	out, err := run("go", "mod", "edit", "-json", "go.mod")
	if err != nil {
		return fmt.Errorf("exporting go.mod: %w", err)
	}
	var mod gomod
	err = json.Unmarshal(out, &mod)
	if err != nil {
		return fmt.Errorf("reading go.mod: %w", err)
	}

	// Move relative `replace` paths up or down a directory.
	for idx, r := range mod.Replace {
		if strings.HasPrefix(r.New.Path, "../") {
			r.New.Path = strings.Replace(r.New.Path, "../", "./", 1)
		} else if strings.HasPrefix(r.New.Path, "./") {
			r.New.Path = strings.Replace(r.New.Path, "./", "./provider/", 1)
		}
		if r.New.Path == mod.Replace[idx].New.Path {
			continue // Unchanged.
		}

		// Commit the changes.
		old := r.Old.Path
		if r.Old.Version != "" {
			old += "@" + r.Old.Version
		}
		_, err = run("go", "mod", "edit", fmt.Sprintf("-replace=%s=%s", old, r.New.Path))
		if err != nil {
			return fmt.Errorf("replacing %q: %w", old, err)
		}
	}

	// Remove examples/tests modules. We'll recover their requirements with a
	// `tidy` at the end. It's OK if these don't exist.
	_, _ = run("git", "rm", "examples/go.mod")
	_, _ = run("git", "rm", "examples/go.sum")
	_, _ = run("git", "rm", "tests/go.mod")
	_, _ = run("git", "rm", "tests/go.sum")

	// Rewrite our module path and determine our new import, if it's changed.
	//
	// The module `github.com/pulumi/pulumi-foo/provider/v6` becomes
	// `github.com/pulumi/pulumi-foo/v6` and existing code should be imported
	// as `github.com/pulumi/pulumi-foo/v6/provider`.
	//
	// For v1 modules, `github.com/pulumi/pulumi-foo/provider` becomes
	// `github.com/pulumi/pulumi-foo` and existing imports are unchanged.

	oldImport := mod.Module.Path
	newModule := filepath.Dir(oldImport) // Strip "/vN" or "/provider".
	newImport := oldImport

	// Handle major version.
	if base := filepath.Base(oldImport); base != "provider" {
		if !strings.HasPrefix(base, "v") {
			return fmt.Errorf("expected a major version, got %q", base)
		}
		newModule = filepath.Join(filepath.Dir(newModule), base)
		newImport = filepath.Join(newModule, "provider")
	}

	// Update our module name.
	_, err = run("go", "mod", "edit", "-module="+newModule)
	if err != nil {
		return fmt.Errorf("rewriting module name: %w", err)
	}

	// Re-write imports for our provider, examples, and tests modules.
	rewriteImport := func(oldImport, newImport string) error {
		if oldImport == newImport {
			return nil // Nothing to do.
		}
		_, err := run("find", ".",
			"-type", "f",
			"-not", "-path", "./sdk/*",
			"-not", "-path", "./upstream/*",
			"-not", "-path", "./.git/*",
			"-not", "-path", "./.pulumi/*",
			"-exec", "sed", "-i.bak",
			fmt.Sprintf("s/%s/%s/g",
				strings.Replace(oldImport, "/", `\/`, -1),
				strings.Replace(newImport, "/", `\/`, -1),
			), "{}", ";")
		if err != nil {
			return fmt.Errorf("rewriting %q to %q: %w", oldImport, newImport, err)
		}
		_, err = run("find", ".", "-name", "*.bak", "-exec", "rm", "{}", "+")
		if err != nil {
			return fmt.Errorf("cleaning up: %w", err)
		}
		return nil

	}
	if err := rewriteImport(oldImport, newImport); err != nil {
		return err
	}
	if err := rewriteImport(
		strings.Replace(oldImport, "provider", "examples", 1),
		strings.Replace(newImport, "provider", "examples", 1),
	); err != nil {
		return err
	}
	if err := rewriteImport(
		strings.Replace(oldImport, "provider", "tests", 1),
		strings.Replace(newImport, "provider", "tests", 1),
	); err != nil {
		return err
	}

	// Tidy up.
	_, err = run("go", "mod", "tidy")
	if err != nil {
		return fmt.Errorf("tidying up: %w", err)
	}

	return nil

}

// The types below are for loading the module as JSON and are copied from `go
// help mod edit`.

type module struct {
	Path    string
	Version string
}

type gomod struct {
	Module    modpath
	Go        string
	Toolchain string
	Require   []requirement
	Exclude   []module
	Replace   []replace
	Retract   []retract
}

type modpath struct {
	Path       string
	Deprecated string
}

type requirement struct {
	Path     string
	Version  string
	Indirect bool
}

type replace struct {
	Old module
	New module
}

type retract struct {
	Low       string
	High      string
	Rationale string
}
