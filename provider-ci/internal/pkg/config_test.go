package pkg

import (
	"os"
	"path/filepath"
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

func TestLoadLocalConfigDefaultsAgenticWorkflowsEnabled(t *testing.T) {
	dir := t.TempDir()

	configPath := filepath.Join(dir, ".ci-mgmt.yaml")
	if err := os.WriteFile(configPath, []byte("provider: aws\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	config, err := LoadLocalConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if config.DisableAgenticWorkflows {
		t.Fatal("expected agentic workflows to be enabled by default")
	}
}

func TestLoadLocalConfigCanDisableAgenticWorkflows(t *testing.T) {
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
		t.Fatal("expected local config to disable agentic workflows")
	}
}

func TestGeneratePackageCanDisableAgenticWorkflows(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true
	config.DisableAgenticWorkflows = true

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
	for _, path := range []string{
		".github/workflows/gh-aw-pr-rereview.lock.yml",
		".github/workflows/gh-aw-pr-rereview.md",
		".github/workflows/gh-aw-pr-review.lock.yml",
		".github/workflows/gh-aw-pr-review.md",
	} {
		if _, err := os.Stat(filepath.Join(outDir, path)); err != nil {
			t.Fatalf("expected %s to exist, got err %v", path, err)
		}
	}
}
