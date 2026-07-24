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

func TestLoadLocalConfigValidatesAcceptanceTestSuites(t *testing.T) {
	tests := []struct {
		name    string
		config  string
		wantErr string
	}{
		{
			name: "valid",
			config: `provider: aws
acceptanceTestSuites:
  - name: provider
    root: provider-tests
    shards: 4
    requiresSDKs: false
  - name: sdk
    root: sdk-smoke
    shards: 2
    requiresSDKs: true
`,
		},
		{
			name: "legacy shards conflict",
			config: `provider: aws
shards: 8
acceptanceTestSuites:
  - name: provider
    root: provider-tests
    shards: 4
    requiresSDKs: false
`,
			wantErr: "acceptanceTestSuites cannot be used with shards",
		},
		{
			name: "SDK requirement omitted",
			config: `provider: aws
acceptanceTestSuites:
  - name: provider
    root: provider-tests
    shards: 4
`,
			wantErr: "requiresSDKs must be set explicitly",
		},
		{
			name: "overlapping roots",
			config: `provider: aws
acceptanceTestSuites:
  - name: all
    root: tests
    shards: 4
    requiresSDKs: false
  - name: sdk
    root: tests/sdk
    shards: 2
    requiresSDKs: true
`,
			wantErr: "overlaps another suite root",
		},
		{
			name: "invalid job name",
			config: `provider: aws
acceptanceTestSuites:
  - name: SDK_Smoke
    root: sdk-smoke
    shards: 2
    requiresSDKs: true
`,
			wantErr: "name must match",
		},
		{
			name: "shell-unsafe root",
			config: `provider: aws
acceptanceTestSuites:
  - name: sdk
    root: sdk$(touch-bad)
    shards: 2
    requiresSDKs: true
`,
			wantErr: "shell-safe relative path",
		},
		{
			name: "SDKs unavailable",
			config: `provider: aws
noSchema: true
acceptanceTestSuites:
  - name: sdk
    root: sdk-smoke
    shards: 2
    requiresSDKs: true
`,
			wantErr: "cannot require SDKs when noSchema is true",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			configPath := filepath.Join(t.TempDir(), ".ci-mgmt.yaml")
			if err := os.WriteFile(configPath, []byte(tt.config), 0o600); err != nil {
				t.Fatal(err)
			}

			config, err := LoadLocalConfig(configPath)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatal(err)
				}
				if len(config.AcceptanceTestSuites) != 2 || config.AcceptanceTestSuites[0].NeedsSDKs() ||
					!config.AcceptanceTestSuites[1].NeedsSDKs() {
					t.Fatalf("unexpected suites: %#v", config.AcceptanceTestSuites)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("expected error containing %q, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestGeneratePackagePartitionsAcceptanceTestSuites(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true
	config.GenerateNightlyTestWorkflow = true
	requiresSDKs := true
	doesNotRequireSDKs := false
	config.AcceptanceTestSuites = []acceptanceTestSuite{
		{Name: "provider", Root: "provider-tests", Shards: 4, RequiresSDKs: &doesNotRequireSDKs},
		{Name: "sdk", Root: "sdk-smoke", Shards: 2, RequiresSDKs: &requiresSDKs},
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

	readWorkflow := func(name string) string {
		t.Helper()
		workflow, err := os.ReadFile(filepath.Join(outDir, ".github", "workflows", name))
		if err != nil {
			t.Fatal(err)
		}
		return string(workflow)
	}

	testWorkflow := readWorkflow("test.yml")
	for _, want := range []string{
		"suite_root:\n",
		"if: inputs.requires_sdks\n",
		"SUITE_ROOT: ${{ inputs.suite_root }}",
		`--root "$SUITE_ROOT"`,
		"current-shard: ${{ fromJSON(inputs.shard_indices) }}",
	} {
		if !strings.Contains(testWorkflow, want) {
			t.Errorf("test workflow does not contain %q", want)
		}
	}

	for _, name := range []string{"run-acceptance-tests.yml", "master.yml", "nightly-test.yml", "prerelease.yml", "release.yml"} {
		workflow := readWorkflow(name)
		if !strings.Contains(workflow, "  acceptance_provider:\n") || !strings.Contains(workflow, "  acceptance_sdk:\n") {
			t.Errorf("%s does not call both configured suites", name)
		}
		providerStart := strings.Index(workflow, "  acceptance_provider:\n")
		sdkStart := strings.Index(workflow, "  acceptance_sdk:\n")
		providerJob := workflow[providerStart:sdkStart]
		if strings.Contains(providerJob, "      - build_sdk\n") {
			t.Errorf("%s makes the provider-only suite wait for build_sdk", name)
		}
		sdkJob := workflow[sdkStart:]
		if !strings.Contains(sdkJob, "      - build_sdk\n") {
			t.Errorf("%s does not make the SDK suite wait for build_sdk", name)
		}
	}

	acceptanceWorkflow := readWorkflow("run-acceptance-tests.yml")
	if !strings.Contains(acceptanceWorkflow, "    - acceptance_provider\n    - acceptance_sdk\n    - build_sdk\n") {
		t.Errorf("acceptance sentinel does not require every suite and the SDK build")
	}
}

func TestGeneratePackageRejectsAcceptanceTestSuitesForNativeTemplates(t *testing.T) {
	requiresSDKs := false
	config := Config{
		AcceptanceTestSuites: []acceptanceTestSuite{
			{Name: "provider", Root: ".", Shards: 1, RequiresSDKs: &requiresSDKs},
		},
	}

	for _, templateName := range []string{"native", "external-native-provider"} {
		t.Run(templateName, func(t *testing.T) {
			err := GeneratePackage(GenerateOpts{
				OutDir:       t.TempDir(),
				TemplateName: templateName,
				Config:       config,
			})
			if err == nil || !strings.Contains(err.Error(), "not supported by native workflow templates") {
				t.Fatalf("expected native template error, got %v", err)
			}
		})
	}
}

func TestGeneratePackagePreservesLegacyShardedTestWorkflow(t *testing.T) {
	outDir := t.TempDir()

	config, err := loadDefaultConfig()
	if err != nil {
		t.Fatal(err)
	}
	config.Provider = "aws"
	config.ESC.Enabled = true
	config.Shards = 8

	if err := GeneratePackage(GenerateOpts{
		RepositoryName: "pulumi/pulumi-aws",
		OutDir:         outDir,
		TemplateName:   "bridged-provider",
		Config:         config,
		SkipMigrations: true,
	}); err != nil {
		t.Fatal(err)
	}

	testWorkflow, err := os.ReadFile(filepath.Join(outDir, ".github", "workflows", "test.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(testWorkflow), "suite_root") {
		t.Fatal("legacy test workflow unexpectedly contains suite inputs")
	}

	acceptanceWorkflow, err := os.ReadFile(filepath.Join(outDir, ".github", "workflows", "run-acceptance-tests.yml"))
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"  test:\n", "    - test\n", "      - build_sdk\n"} {
		if !strings.Contains(string(acceptanceWorkflow), want) {
			t.Errorf("legacy acceptance workflow does not contain %q", want)
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
