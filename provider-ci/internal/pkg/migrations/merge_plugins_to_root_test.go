package migrations

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMergePluginsToRootCreatesNewFile(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml with plugins
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[tools]
"github:pulumi/pulumictl" = "latest"
"vfox-pulumi:pulumi/pulumi-aws" = "latest"

[plugins]
"vfox-pulumi" = "https://github.com/pulumi/vfox-pulumi"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml was created with plugins
	rootPath := filepath.Join(dir, "mise.toml")
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-aws" = "latest"`) {
		t.Fatalf("expected vfox-pulumi plugin in root mise.toml, got:\n%s", contentStr)
	}
}

func TestMergePluginsToRootMergesIntoExistingFile(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml with plugins
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[plugins]
"vfox-pulumi" = "https://github.com/pulumi/vfox-pulumi"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Create existing root mise.toml with other content
	rootPath := filepath.Join(dir, "mise.toml")
	rootContent := `[tools]
"github:pulumi/pulumi-go" = "latest"

[env]
PULUMI_EXPERIMENTAL = "true"
`
	if err := os.WriteFile(rootPath, []byte(rootContent), 0o644); err != nil {
		t.Fatalf("write root mise.toml: %v", err)
	}

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml has both original content and new plugins
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	// Check original content is preserved
	if !strings.Contains(contentStr, `[tools]`) {
		t.Fatalf("expected [tools] section preserved in root mise.toml, got:\n%s", contentStr)
	}
	if !strings.Contains(contentStr, `PULUMI_EXPERIMENTAL = "true"`) {
		t.Fatalf("expected env section preserved in root mise.toml, got:\n%s", contentStr)
	}
}

func TestMergePluginsToRootDoesNotOverwriteExisting(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml with plugins
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[plugins]
"vfox-pulumi" = "https://github.com/pulumi/vfox-pulumi"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Create root mise.toml with existing plugin (different URL)
	rootPath := filepath.Join(dir, "mise.toml")
	rootContent := `[plugins]
"vfox-pulumi" = "https://example.com/custom-vfox-pulumi"
`
	if err := os.WriteFile(rootPath, []byte(rootContent), 0o644); err != nil {
		t.Fatalf("write root mise.toml: %v", err)
	}

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml keeps the original plugin value
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	if !strings.Contains(contentStr, `"vfox-pulumi" = "https://example.com/custom-vfox-pulumi"`) {
		t.Fatalf("expected original vfox-pulumi URL preserved in root mise.toml, got:\n%s", contentStr)
	}
	if strings.Contains(contentStr, `https://github.com/pulumi/vfox-pulumi`) {
		t.Fatalf("expected migration not to overwrite existing plugin in root mise.toml, got:\n%s", contentStr)
	}
}

func TestMergePluginsToRootNoPluginsToMerge(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml without plugins section
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[tools]
"github:pulumi/pulumictl" = "latest"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml was not created
	rootPath := filepath.Join(dir, "mise.toml")
	if _, err := os.Stat(rootPath); err == nil {
		t.Fatalf("expected root mise.toml not to be created when no plugins to migrate")
	}
}

func TestMergePluginsToRootNoConfigFile(t *testing.T) {
	dir := t.TempDir()

	// Don't create .config/mise.toml at all

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml was not created
	rootPath := filepath.Join(dir, "mise.toml")
	if _, err := os.Stat(rootPath); err == nil {
		t.Fatalf("expected root mise.toml not to be created when .config/mise.toml doesn't exist")
	}
}

func TestMergePluginsToRootMergesVfoxTools(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml with vfox-pulumi tools
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[tools]
go = "latest"
"vfox-pulumi:pulumi/pulumi-aws" = "7.6.6"
"vfox-pulumi:pulumi/pulumi-gcp" = "8.0.0"

[plugins]
"vfox-pulumi" = "https://github.com/pulumi/vfox-pulumi"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml was created with both tools and plugins
	rootPath := filepath.Join(dir, "mise.toml")
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	if !strings.Contains(contentStr, "[tools]") {
		t.Fatalf("expected [tools] section in root mise.toml, got:\n%s", contentStr)
	}
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-aws" = "7.6.6"`) {
		t.Fatalf("expected pulumi-aws tool in root mise.toml, got:\n%s", contentStr)
	}
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-gcp" = "8.0.0"`) {
		t.Fatalf("expected pulumi-gcp tool in root mise.toml, got:\n%s", contentStr)
	}

	// Verify non-vfox tools are NOT included
	if strings.Contains(contentStr, `go = "latest"`) {
		t.Fatalf("expected non-vfox tools NOT to be merged, got:\n%s", contentStr)
	}
}

func TestMergePluginsToRootFromCiMgmtYaml(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml without plugins
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[tools]
go = "latest"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Create .ci-mgmt.yaml with plugins
	ciMgmtPath := filepath.Join(dir, ".ci-mgmt.yaml")
	ciMgmtContent := `plugins:
  - name: aws
    version: 5.0.0
  - name: eks
    version: 1.2.3
    kind: bridge
`
	if err := os.WriteFile(ciMgmtPath, []byte(ciMgmtContent), 0o644); err != nil {
		t.Fatalf("write .ci-mgmt.yaml: %v", err)
	}

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml was created with plugins from .ci-mgmt.yaml
	rootPath := filepath.Join(dir, "mise.toml")
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	if !strings.Contains(contentStr, "[tools]") {
		t.Fatalf("expected [tools] section in root mise.toml, got:\n%s", contentStr)
	}
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-aws" = "5.0.0"`) {
		t.Fatalf("expected pulumi-aws tool from .ci-mgmt.yaml in root mise.toml, got:\n%s", contentStr)
	}
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-bridge-eks" = "1.2.3"`) {
		t.Fatalf("expected pulumi-bridge-eks tool from .ci-mgmt.yaml in root mise.toml, got:\n%s", contentStr)
	}

	// Verify non-vfox tools are NOT included
	if strings.Contains(contentStr, `go = "latest"`) {
		t.Fatalf("expected non-vfox tools NOT to be merged, got:\n%s", contentStr)
	}
}

func TestMergePluginsToRootFromBothSources(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml with some plugins
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[tools]
"vfox-pulumi:pulumi/pulumi-gcp" = "8.0.0"

[plugins]
"vfox-pulumi" = "https://github.com/pulumi/vfox-pulumi"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Create .ci-mgmt.yaml with different plugins
	ciMgmtPath := filepath.Join(dir, ".ci-mgmt.yaml")
	ciMgmtContent := `plugins:
  - name: aws
    version: 5.0.0
`
	if err := os.WriteFile(ciMgmtPath, []byte(ciMgmtContent), 0o644); err != nil {
		t.Fatalf("write .ci-mgmt.yaml: %v", err)
	}

	// Run plugin merge
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot: %v", err)
	}

	// Verify root mise.toml has plugins from both sources
	rootPath := filepath.Join(dir, "mise.toml")
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	// From .config/mise.toml
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-gcp" = "8.0.0"`) {
		t.Fatalf("expected pulumi-gcp tool from .config/mise.toml in root mise.toml, got:\n%s", contentStr)
	}
	// From .ci-mgmt.yaml
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-aws" = "5.0.0"`) {
		t.Fatalf("expected pulumi-aws tool from .ci-mgmt.yaml in root mise.toml, got:\n%s", contentStr)
	}
}

func TestMergePluginsToRootNoCiMgmtYaml(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml with plugins
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[tools]
"vfox-pulumi:pulumi/pulumi-aws" = "7.6.6"

[plugins]
"vfox-pulumi" = "https://github.com/pulumi/vfox-pulumi"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Don't create .ci-mgmt.yaml

	// Run plugin merge - should succeed even without .ci-mgmt.yaml
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot should succeed without .ci-mgmt.yaml: %v", err)
	}

	// Verify root mise.toml was created with plugins from .config/mise.toml
	rootPath := filepath.Join(dir, "mise.toml")
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-aws" = "7.6.6"`) {
		t.Fatalf("expected pulumi-aws tool in root mise.toml, got:\n%s", contentStr)
	}
}

func TestMergePluginsToRootCiMgmtYamlWithoutPlugins(t *testing.T) {
	dir := t.TempDir()
	configDir := filepath.Join(dir, ".config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir .config: %v", err)
	}

	// Create .config/mise.toml with plugins
	configPath := filepath.Join(configDir, "mise.toml")
	configContent := `[tools]
"vfox-pulumi:pulumi/pulumi-aws" = "7.6.6"

[plugins]
"vfox-pulumi" = "https://github.com/pulumi/vfox-pulumi"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0o644); err != nil {
		t.Fatalf("write .config/mise.toml: %v", err)
	}

	// Create .ci-mgmt.yaml without plugins key
	ciMgmtPath := filepath.Join(dir, ".ci-mgmt.yaml")
	ciMgmtContent := `provider: aws
version: 1.0.0
`
	if err := os.WriteFile(ciMgmtPath, []byte(ciMgmtContent), 0o644); err != nil {
		t.Fatalf("write .ci-mgmt.yaml: %v", err)
	}

	// Run plugin merge - should succeed even with .ci-mgmt.yaml without plugins
	migration := mergePluginsToRoot{}
	if err := migration.Migrate("bridged-provider", dir); err != nil {
		t.Fatalf("mergePluginsToRoot should succeed with .ci-mgmt.yaml without plugins: %v", err)
	}

	// Verify root mise.toml was created with plugins from .config/mise.toml only
	rootPath := filepath.Join(dir, "mise.toml")
	content, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("read root mise.toml: %v", err)
	}

	contentStr := string(content)
	if !strings.Contains(contentStr, `"vfox-pulumi:pulumi/pulumi-aws" = "7.6.6"`) {
		t.Fatalf("expected pulumi-aws tool in root mise.toml, got:\n%s", contentStr)
	}
}
