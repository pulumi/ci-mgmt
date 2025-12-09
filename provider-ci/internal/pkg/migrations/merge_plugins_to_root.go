package migrations

import (
	"fmt"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// mergePluginsToRoot merges vfox-pulumi tools from .config/mise.toml
// into the root-level mise.toml file (creating it if it doesn't exist).
// Note: This only merges [tools] entries, not [plugins] entries.
type mergePluginsToRoot struct{}

func (mergePluginsToRoot) Name() string {
	return "Merge vfox-pulumi plugins from .config/mise.toml to root mise.toml"
}

func (mergePluginsToRoot) ShouldRun(templateName string) bool {
	return true
}

func (mergePluginsToRoot) Migrate(templateName, outDir string) error {
	configPath := filepath.Join(outDir, ".config", "mise.toml")
	rootPath := filepath.Join(outDir, "mise.toml")
	ciMgmtPath := filepath.Join(outDir, ".ci-mgmt.yaml")

	fmt.Printf("  [mergePluginsToRoot] Starting plugin/tool merge\n")
	fmt.Printf("  [mergePluginsToRoot] Config path: %s\n", configPath)
	fmt.Printf("  [mergePluginsToRoot] Root path: %s\n", rootPath)
	fmt.Printf("  [mergePluginsToRoot] CI-Mgmt path: %s\n", ciMgmtPath)

	// Load the .config/mise.toml file
	configFile, err := newTomlFile(configPath)
	if err != nil {
		fmt.Printf("  [mergePluginsToRoot] ERROR loading config file: %v\n", err)
		return fmt.Errorf("error loading .config/mise.toml: %w", err)
	}
	fmt.Printf("  [mergePluginsToRoot] Successfully loaded config file (size: %d bytes)\n", len(configFile.content))

	// Get vfox-pulumi tool entries from [tools] section
	allToolEntries := configFile.getSection("tools")
	var vfoxToolEntries []sectionEntry
	for _, entry := range allToolEntries {
		if len(entry.key) >= 11 && entry.key[:11] == "vfox-pulumi" {
			vfoxToolEntries = append(vfoxToolEntries, entry)
		}
	}
	fmt.Printf("  [mergePluginsToRoot] Found %d vfox-pulumi tools in [tools] section\n", len(vfoxToolEntries))

	// Also check .ci-mgmt.yaml for plugins
	cimgmt, err := newCimgmtYaml(ciMgmtPath)
	if err != nil {
		fmt.Printf("  [mergePluginsToRoot] WARNING: Could not load .ci-mgmt.yaml: %v\n", err)
		// Continue even if .ci-mgmt.yaml doesn't exist or can't be loaded
	} else {
		plugins := cimgmt.getFieldNode("plugins")
		if plugins != nil {
			fmt.Printf("  [mergePluginsToRoot] Found 'plugins' key in .ci-mgmt.yaml\n")
			pluginList := nodeToPluginEntries(plugins)
			fmt.Printf("  [mergePluginsToRoot] Parsed %d plugin entries from .ci-mgmt.yaml\n", len(pluginList))

			// Convert plugins to tool entries and add to vfoxToolEntries
			ciMgmtToolEntries := pluginsToToolEntries(pluginList)
			if len(ciMgmtToolEntries) > 0 {
				vfoxToolEntries = append(vfoxToolEntries, ciMgmtToolEntries...)
				fmt.Printf("  [mergePluginsToRoot] Added %d tool entries from .ci-mgmt.yaml plugins\n", len(ciMgmtToolEntries))
			}
		} else {
			fmt.Printf("  [mergePluginsToRoot] No 'plugins' key found in .ci-mgmt.yaml\n")
		}
	}

	// If nothing to merge, skip
	if len(vfoxToolEntries) == 0 {
		fmt.Println("  [mergePluginsToRoot] No vfox-pulumi tools to merge - skipping")
		return nil
	}

	// Show what we're merging
	if len(vfoxToolEntries) > 0 {
		fmt.Printf("  [mergePluginsToRoot] vfox-pulumi tool entries to merge:\n")
		for _, entry := range vfoxToolEntries {
			fmt.Printf("    [tools] %s = %s\n", entry.key, entry.value)
		}
	}

	// Load or create the root-level mise.toml
	fmt.Printf("  [mergePluginsToRoot] Loading/creating root mise.toml at %s\n", rootPath)
	rootFile, err := newTomlFile(rootPath)
	if err != nil {
		fmt.Printf("  [mergePluginsToRoot] ERROR loading root file: %v\n", err)
		return fmt.Errorf("error loading root mise.toml: %w", err)
	}
	fmt.Printf("  [mergePluginsToRoot] Root file loaded (existing size: %d bytes)\n", len(rootFile.content))

	// Merge vfox-pulumi tool entries into [tools] section
	if len(vfoxToolEntries) > 0 {
		fmt.Printf("  [mergePluginsToRoot] Merging [tools] entries...\n")
		updated, err := rootFile.ensureSectionEntries("tools", vfoxToolEntries)
		if err != nil {
			fmt.Printf("  [mergePluginsToRoot] ERROR merging tools: %v\n", err)
			return fmt.Errorf("error merging tools into root mise.toml: %w", err)
		}
		fmt.Printf("  [mergePluginsToRoot] [tools] merge completed (updated=%v)\n", updated)
	}

	// Write the updated root-level mise.toml
	fmt.Printf("  [mergePluginsToRoot] Writing root mise.toml (size: %d bytes)...\n", len(rootFile.content))
	if err := rootFile.writeFile(); err != nil {
		fmt.Printf("  [mergePluginsToRoot] ERROR writing file: %v\n", err)
		return fmt.Errorf("error writing root mise.toml: %w", err)
	}

	fmt.Printf("  [mergePluginsToRoot] Successfully wrote root mise.toml to %s\n", rootPath)
	return nil
}

// cimgmtPluginEntry represents a plugin entry from .ci-mgmt.yaml
type cimgmtPluginEntry struct {
	Name    string
	Version string
	Kind    string
}

// nodeToPluginEntries converts a YAML node to plugin entries
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

// pluginsToToolEntries converts plugin entries to mise tool entries
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
