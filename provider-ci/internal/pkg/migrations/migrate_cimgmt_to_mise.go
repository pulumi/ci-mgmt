package migrations

import (
	_ "embed"
	"fmt"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

//go:embed mise.toml
var defaultConfigMiseToml string

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
	existingMise, err := newTomlFile(misePath)
	if err != nil {
		return err
	}

	// Extract existing plugin entries from current mise.toml to preserve them
	existingPluginEntries := extractPluginEntries(existingMise)

	// Always start with the default mise.toml content
	mise, err := newTomlFile(misePath)
	if err != nil {
		return err
	}
	mise.content = []byte(defaultConfigMiseToml)

	// Re-apply existing plugin entries
	if len(existingPluginEntries) > 0 {
		_, err = mise.ensureSectionEntries("tools", existingPluginEntries)
		if err != nil {
			return fmt.Errorf("error re-applying existing plugin entries: %w", err)
		}
		_, err = mise.ensureSectionEntries("plugins", []sectionEntry{
			{key: "vfox-pulumi", value: "https://github.com/pulumi/vfox-pulumi"},
		})
		if err != nil {
			return fmt.Errorf("error ensuring mise plugins entry: %w", err)
		}
	}

	plugins := cimgmt.getFieldNode("plugins")
	if plugins == nil {
		// No new plugins to migrate, just write the default content with existing plugins
		return mise.writeFile()
	}

	// If we have any plugins overrides, move them to the .config/mise.toml
	pluginList := nodeToPluginEntries(plugins)
	entries := pluginsToToolEntries(pluginList)

	_, err = mise.ensureSectionEntries("tools", entries)
	if err != nil {
		return fmt.Errorf("error ensuring mise plugin entry: %w", err)
	}

	if len(entries) > 0 {
		_, err = mise.ensureSectionEntries("plugins", []sectionEntry{
			{key: "vfox-pulumi", value: "https://github.com/pulumi/vfox-pulumi"},
		})
		if err != nil {
			return fmt.Errorf("error ensuring mise plugins entry: %w", err)
		}
	}

	// Always write the mise.toml file since we start with the default
	if err := mise.writeFile(); err != nil {
		return err
	}

	cimgmt.deleteKey("plugins")
	return cimgmt.writeFile()
}

// extractPluginEntries extracts plugin entries from an existing mise.toml file
// so they can be preserved when regenerating from the default template
func extractPluginEntries(tomlFile *tomlFile) []sectionEntry {
	tools := tomlFile.getSection("tools")
	if tools == nil {
		return nil
	}

	var entries []sectionEntry
	for _, entry := range tools {
		// Only preserve vfox-pulumi entries (project-specific plugins)
		// Don't preserve other tools as they should come from the default
		if len(entry.key) > 11 && entry.key[:11] == "vfox-pulumi" {
			entries = append(entries, entry)
		}
	}

	return entries
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

func pluginsToToolEntries(plugins []cimgmtPluginEntry) []sectionEntry {
	if len(plugins) == 0 {
		return nil
	}

	entries := make([]sectionEntry, 0, len(plugins))
	index := make(map[string]int, len(plugins))
	for _, plugin := range plugins {
		repoName := fmt.Sprintf("pulumi-%s", plugin.Name)
		org := "pulumi"
		if plugin.Kind != "" {
			repoName = fmt.Sprintf("pulumi-%s-%s", plugin.Kind, plugin.Name)
		}
		// special handling for the `time` provider which is a pulumiverse provider
		// the plugins entry doesn't have any info on the GitHub org that the provider belongs to
		// so we have to hardcode it for the 1 time migration
		if plugin.Name == "time" {
			org = "pulumiverse"
		}
		name := fmt.Sprintf("vfox-pulumi:%s/%s", org, repoName)
		// Use the version from the plugin config if specified, otherwise default to latest
		version := plugin.Version
		if version == "" {
			version = "latest"
		}

		if pos, ok := index[name]; ok {
			entries[pos].value = version
			continue
		}

		index[name] = len(entries)
		entries = append(entries, sectionEntry{
			key:   name,
			value: version,
		})
	}

	return entries
}
