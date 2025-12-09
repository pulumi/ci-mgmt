package migrations

import (
	"fmt"
	"path/filepath"
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

	fmt.Printf("  [mergePluginsToRoot] Starting plugin/tool merge\n")
	fmt.Printf("  [mergePluginsToRoot] Config path: %s\n", configPath)
	fmt.Printf("  [mergePluginsToRoot] Root path: %s\n", rootPath)

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
