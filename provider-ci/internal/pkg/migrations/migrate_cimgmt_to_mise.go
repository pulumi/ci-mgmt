package migrations

import (
	"fmt"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// migrates things from ci-mgmt.yaml to `.config/mise.toml`
type migrateCimgmtToMise struct{}

func (migrateCimgmtToMise) Name() string {
	return "Migrate ci-mgmt.yml entries to the default .config/mise.toml file"
}
func (migrateCimgmtToMise) ShouldRun(templateName string) bool {
	return true
}

func (migrateCimgmtToMise) Migrate(templateName, outDir string) error {
	ciMgmtPath := filepath.Join(outDir, ".ci-mgmt.yaml")
	cimgmt, err := newCimgmtYaml(ciMgmtPath)
	if err != nil {
		return err
	}

	misePath := filepath.Join(outDir, ".config", "mise.toml")
	mise, err := newTomlFile(misePath)
	if err != nil {
		return err
	}

	plugins := cimgmt.getFieldNode("plugins")
	if plugins == nil {
		return nil
	}

	// If we have any plugins overrides, move them to the .config/mise.toml
	pluginList := nodeToPluginEntries(plugins)
	entries := pluginsToToolEntries(pluginList)
	updated, err := mise.ensureToolsEntries(entries)
	if err != nil {
		return fmt.Errorf("error updating mise.toml: %w", err)
	}
	if updated {
		err := mise.writeFile()
		if err != nil {
			return err
		}
	}

	// Finally remove the toolVersions from .ci-mgmt.yaml
	cimgmt.deleteKey("plugins")
	return cimgmt.writeFile()
}

type cimgmtPluginEntry struct {
	Name    string
	Version string
	Kind    string
}

func nodeToPluginEntries(m *yaml.Node) []cimgmtPluginEntry {
	if m == nil || m.Kind != yaml.SequenceNode {
		return nil
	}

	out := make([]cimgmtPluginEntry, 0, len(m.Content))
	for _, entry := range m.Content {
		if entry.Kind != yaml.MappingNode {
			continue
		}
		var plugin cimgmtPluginEntry
		for i := 0; i < len(entry.Content); i += 2 {
			k := entry.Content[i]
			if i+1 >= len(entry.Content) {
				continue
			}
			v := entry.Content[i+1]
			switch k.Value {
			case "name":
				plugin.Name = v.Value
			case "version":
				plugin.Version = v.Value
			case "kind":
				plugin.Kind = v.Value
			}
		}
		out = append(out, plugin)
	}

	return out
}

func pluginsToToolEntries(plugins []cimgmtPluginEntry) []toolEntry {
	if len(plugins) == 0 {
		return nil
	}

	entries := make([]toolEntry, 0, len(plugins))
	index := make(map[string]int, len(plugins))
	for _, plugin := range plugins {
		repoName := fmt.Sprintf("pulumi-%s", plugin.Name)
		if plugin.Kind != "" {
			repoName = fmt.Sprintf("pulumi-%s-%s", plugin.Kind, plugin.Name)
		}
		name := fmt.Sprintf("github:pulumi/%s", repoName)
		// set to latest so we can update via `mise upgrade`
		version := "latest"

		if pos, ok := index[name]; ok {
			entries[pos].version = version
			continue
		}

		index[name] = len(entries)
		entries = append(entries, toolEntry{
			name:    name,
			version: version,
		})
	}

	return entries
}
