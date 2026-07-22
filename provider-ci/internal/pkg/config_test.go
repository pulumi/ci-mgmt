package pkg

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadLocalConfigDefaultsMajorProviderUpgradesEnabled(t *testing.T) {
	dir := t.TempDir()

	configPath := filepath.Join(dir, ".ci-mgmt.yaml")
	if err := os.WriteFile(configPath, []byte("provider: aws\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	config, err := LoadLocalConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if config.DisableMajorProviderUpgrades {
		t.Fatal("expected major provider upgrades to be enabled by default")
	}
}

func TestLoadLocalConfigCanDisableMajorProviderUpgrades(t *testing.T) {
	dir := t.TempDir()

	configPath := filepath.Join(dir, ".ci-mgmt.yaml")
	if err := os.WriteFile(configPath, []byte(`provider: aws
disableMajorProviderUpgrades: true
`), 0o600); err != nil {
		t.Fatal(err)
	}

	config, err := LoadLocalConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if !config.DisableMajorProviderUpgrades {
		t.Fatal("expected local config to disable major provider upgrades")
	}
}

func TestLoadLocalConfigAcceptsDeprecatedDisableAgenticWorkflows(t *testing.T) {
	dir := t.TempDir()

	configPath := filepath.Join(dir, ".ci-mgmt.yaml")
	if err := os.WriteFile(configPath, []byte(`provider: aws
disableAgenticWorkflows: true
`), 0o600); err != nil {
		t.Fatal(err)
	}

	config, err := LoadLocalConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if !config.DisableAgenticWorkflows {
		t.Fatal("expected local config to preserve deprecated disableAgenticWorkflows value")
	}
}

func TestGeneratePackageRendersOpenInspectSettings(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true
	config.OpenInspect.Settings = map[string]any{
		"mode": "provider",
		"setup": map[string]any{
			"timeout": 900,
		},
	}

	if err := GeneratePackage(GenerateOpts{
		RepositoryName: "pulumi/pulumi-aws",
		OutDir:         outDir,
		TemplateName:   "native",
		Config:         config,
		SkipMigrations: true,
	}); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(filepath.Join(outDir, ".openinspect", "settings.json"))
	if err != nil {
		t.Fatal(err)
	}

	var settings map[string]any
	if err := json.Unmarshal(data, &settings); err != nil {
		t.Fatal(err)
	}

	pathPrepend, ok := settings["pathPrepend"].([]any)
	if !ok || len(pathPrepend) != 1 || pathPrepend[0] != "~/.local/share/mise/shims" {
		t.Fatalf("expected default pathPrepend, got %#v", settings["pathPrepend"])
	}
	if settings["mode"] != "provider" {
		t.Fatalf("expected custom setting to be rendered, got %#v", settings["mode"])
	}
	setup, ok := settings["setup"].(map[string]any)
	if !ok || setup["timeout"] != float64(900) {
		t.Fatalf("expected nested custom setting to be rendered, got %#v", settings["setup"])
	}
}

func TestGeneratePackageDeletesLegacyClaudeFiles(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true

	legacyFiles := []string{
		".claude/CLAUDE.md",
		".claude/skills/provider-code-review/SKILL.md",
		".claude/skills/pulumi-upgrade-provider/SKILL.md",
		".claude/skills/pulumi-upgrade-provider/references/upgrade-provider-errors.md",
		".claude/skills/upstream-patches/SKILL.md",
	}
	for _, path := range legacyFiles {
		fullPath := filepath.Join(outDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(fullPath, []byte("legacy generated file\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	unmanagedFile := ".claude/skills/provider-owned/SKILL.md"
	fullUnmanagedPath := filepath.Join(outDir, unmanagedFile)
	if err := os.MkdirAll(filepath.Dir(fullUnmanagedPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fullUnmanagedPath, []byte("provider-owned file\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	if err := GeneratePackage(GenerateOpts{
		RepositoryName: "pulumi/pulumi-aws",
		OutDir:         outDir,
		TemplateName:   "bridged-provider",
		Config:         config,
		SkipMigrations: true,
	}); err != nil {
		t.Fatal(err)
	}

	for _, path := range legacyFiles {
		if _, err := os.Stat(filepath.Join(outDir, path)); !os.IsNotExist(err) {
			t.Fatalf("expected %s to be absent, got err %v", path, err)
		}
	}
	if _, err := os.Stat(fullUnmanagedPath); err != nil {
		t.Fatalf("expected %s to be preserved, got err %v", unmanagedFile, err)
	}
}

func TestGeneratePackageDeletesLegacyAgenticWorkflowFiles(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true

	for _, path := range getConfigDeletedFiles(config) {
		fullPath := filepath.Join(outDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(fullPath, []byte("legacy generated file\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	unmanagedFiles := []string{
		".github/aw/provider-lock.json",
		".github/snippets/provider-snippet.md",
		".github/workflows/shared/provider-shared.md",
	}
	for _, path := range unmanagedFiles {
		fullPath := filepath.Join(outDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(fullPath, []byte("provider-owned file\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	if err := GeneratePackage(GenerateOpts{
		RepositoryName: "pulumi/pulumi-aws",
		OutDir:         outDir,
		TemplateName:   "bridged-provider",
		Config:         config,
		SkipMigrations: true,
	}); err != nil {
		t.Fatal(err)
	}

	for _, path := range getConfigDeletedFiles(config) {
		if _, err := os.Stat(filepath.Join(outDir, path)); !os.IsNotExist(err) {
			t.Fatalf("expected %s to be absent, got err %v", path, err)
		}
	}
	for _, path := range unmanagedFiles {
		if _, err := os.Stat(filepath.Join(outDir, path)); err != nil {
			t.Fatalf("expected %s to be preserved, got err %v", path, err)
		}
	}
}

func TestGeneratePackageDeletesLegacyProviderPrefixedAgenticWorkflows(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true

	for _, path := range []string{
		".github/workflows/aws-pr-rereview.lock.yml",
		".github/workflows/aws-pr-rereview.md",
		".github/workflows/aws-pr-review.lock.yml",
		".github/workflows/aws-pr-review.md",
	} {
		fullPath := filepath.Join(outDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(fullPath, []byte("legacy workflow\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	if err := GeneratePackage(GenerateOpts{
		RepositoryName: "pulumi/pulumi-aws",
		OutDir:         outDir,
		TemplateName:   "bridged-provider",
		Config:         config,
		SkipMigrations: true,
	}); err != nil {
		t.Fatal(err)
	}

	for _, path := range getConfigDeletedFiles(config) {
		if _, err := os.Stat(filepath.Join(outDir, path)); !os.IsNotExist(err) {
			t.Fatalf("expected %s to be absent, got err %v", path, err)
		}
	}
}

func TestGeneratePackageUsesUpgradeProviderRunner(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true
	config.Runner.UpgradeProvider = "ubuntu-24.04"

	if err := GeneratePackage(GenerateOpts{
		RepositoryName: "pulumi/pulumi-aws",
		OutDir:         outDir,
		TemplateName:   "bridged-provider",
		Config:         config,
		SkipMigrations: true,
	}); err != nil {
		t.Fatal(err)
	}

	workflow, err := os.ReadFile(filepath.Join(outDir, ".github/workflows/upgrade-provider.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(workflow), "    runs-on: ubuntu-24.04\n") {
		t.Fatalf("expected upgrade-provider workflow to use custom runner, got:\n%s", workflow)
	}
}
