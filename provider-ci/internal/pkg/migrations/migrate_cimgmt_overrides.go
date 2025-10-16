package migrations

import (
	"fmt"
	"path/filepath"
	"strings"
)

// migrate any ci-mgmt.yml overrides to the top level mise.toml override file
type migrateCimgmtOverrides struct{}

func (migrateCimgmtOverrides) Name() string {
	return "Migrate entries from .ci-mgmt.yml to the top level mise.toml override file"
}
func (migrateCimgmtOverrides) ShouldRun(templateName string) bool {
	return true
}

// This currently migrates the tool overrides from .ci-mgmt.yaml to a root level
// mise.toml. It can be extended to migrate other fields as well.
func (migrateCimgmtOverrides) Migrate(templateName, outDir string) error {
	ciMgmtPath := filepath.Join(outDir, ".ci-mgmt.yaml")
	cimgmt, err := newCimgmtYaml(ciMgmtPath)
	if err != nil {
		return err
	}

	misePath := filepath.Join(outDir, "mise.toml")
	mise, err := newTomlFile(misePath)
	if err != nil {
		return err
	}

	toolVersions := cimgmt.getFieldNode("toolVersions")
	// if we don't override any toolVersions then we don't need to do anything
	if toolVersions == nil {
		return nil
	}

	if len(mise.content) == 0 {
		mise.content = []byte("# Overwrites mise configuration at .config/mise.toml\n[tools]\n")
	}

	miseTools := []toolEntry{}

	// convert any toolVersions overrides to mise tool entries
	toolVersionsMap := nodeToMap(toolVersions)
	for tool, version := range toolVersionsMap {
		if tool == "go" {
			// don't use go overrides anymore
			continue
		}
		version = strings.TrimSuffix(version, ".x")
		if tool == "java" {
			version = fmt.Sprintf("corretto-%s", version)
		}
		miseTools = append(miseTools, toolEntry{
			name:    tool,
			version: version,
		})
	}

	updated, err := mise.ensureToolsEntries(miseTools)
	if err != nil {
		return fmt.Errorf("error writing toolVersions to mise.toml: %w", err)
	}
	if updated {
		err := mise.writeFile()
		if err != nil {
			return err
		}
	}

	// Finally remove the toolVersions from .ci-mgmt.yaml
	cimgmt.deleteKey("toolVersions")
	return cimgmt.writeFile()
}
