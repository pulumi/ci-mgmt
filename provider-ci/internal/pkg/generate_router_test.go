package pkg

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

// JSON tags match the config loader's YAML keys; Config itself only has YAML tags.
type routerConfig struct {
	Provider                      string          `json:"provider"`
	ProviderDefaultBranch         string          `json:"providerDefaultBranch,omitempty"`
	Template                      string          `json:"template,omitempty"`
	Lint                          bool            `json:"lint,omitempty"`
	GCP                           bool            `json:"gcp,omitempty"`
	TestMasterAndReleaseWorkflows bool            `json:"testMasterAndReleaseWorkflows"`
	ESC                           routerESCConfig `json:"esc"`
}

type routerESCConfig struct {
	Enabled bool `json:"enabled"`
}

func routerTestConfig(t *testing.T, input routerConfig) Config {
	t.Helper()
	data, err := json.Marshal(input)
	require.NoError(t, err, "marshaling test config")
	dir := t.TempDir()
	path := filepath.Join(dir, ".ci-mgmt.yaml")
	require.NoError(t, os.WriteFile(path, data, 0o600), "writing test config")
	config, err := LoadLocalConfig(path)
	require.NoError(t, err, "loading test config")
	return config
}

func routerGenerate(t *testing.T, templateName string, config Config) string {
	t.Helper()
	out := t.TempDir()
	err := GeneratePackage(GenerateOpts{
		RepositoryName: "pulumi/pulumi-" + config.Provider,
		OutDir:         out,
		TemplateName:   templateName,
		Config:         config,
		SkipMigrations: true,
	})
	require.NoError(t, err, "GeneratePackage(%s)", templateName)
	return out
}

func routerWorkflow(t *testing.T, dir, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, ".github", "workflows", name))
	require.NoError(t, err, "reading %s", name)
	return string(data)
}

type routerWorkflowData struct {
	On   map[string]any `yaml:"on"`
	Jobs map[string]struct {
		If    string    `yaml:"if"`
		Needs yaml.Node `yaml:"needs"`
	} `yaml:"jobs"`
}

// Root jobs must carry the repository guard. Ordinary dependent jobs inherit
// their skip behavior; jobs using always() bypass it and need their own guard.
// actionlint validates the dependency graph, so no graph traversal is needed here.
func assertRepositoryGuards(t *testing.T, workflow, repo string) {
	t.Helper()

	var parsed routerWorkflowData
	require.NoError(t, yaml.Unmarshal([]byte(workflow), &parsed), "parsing workflow")
	require.NotEmpty(t, parsed.Jobs, "workflow declares no jobs")

	guard := "github.repository == '" + repo + "'"
	for name, job := range parsed.Jobs {
		// needs can be a scalar job name or a sequence of names.
		hasNeeds := job.Needs.Value != "" || len(job.Needs.Content) > 0
		if hasNeeds && !strings.Contains(job.If, "always()") {
			continue
		}
		assert.Contains(t, job.If, guard, "job %s must explicitly require the repository guard", name)
	}
}

// Public reusable workflows can be invoked by other repositories.
// Require repository guards so release jobs only run for their intended caller.
func TestReusableFlowsGuardRepository(t *testing.T) {
	cases := []struct {
		name     string
		template string
		config   routerConfig
		repo     string
		flows    []string
	}{
		{
			name:     "bridged",
			template: "bridged-provider",
			config: routerConfig{
				Provider:              "aws",
				ProviderDefaultBranch: "master",
				Lint:                  true,
				ESC:                   routerESCConfig{Enabled: true},
			},
			repo:  "pulumi/pulumi-aws",
			flows: []string{"master.yml", "prerelease.yml", "release.yml"},
		},
		{
			name:     "generic",
			template: "generic",
			config: routerConfig{
				Provider:              "pulumiservice",
				ProviderDefaultBranch: "main",
				Template:              "generic",
				Lint:                  true,
				ESC:                   routerESCConfig{Enabled: true},
			},
			repo:  "pulumi/pulumi-pulumiservice",
			flows: []string{"main.yml", "prerelease.yml", "release.yml"},
		},
		{
			name:     "parameterized-go",
			template: "parameterized-go",
			config: routerConfig{
				Provider:              "terraform-module",
				ProviderDefaultBranch: "main",
				Template:              "parameterized-go",
				Lint:                  true,
				ESC:                   routerESCConfig{Enabled: true},
			},
			repo:  "pulumi/pulumi-terraform-module",
			flows: []string{"main.yml", "prerelease.yml", "release.yml"},
		},
		{
			name:     "native",
			template: "native",
			config: routerConfig{
				Provider: "docker-build",
				Template: "native",
				Lint:     true,
				ESC:      routerESCConfig{Enabled: true},
			},
			repo:  "pulumi/pulumi-docker-build",
			flows: []string{"build.yml", "prerelease.yml", "release.yml"},
		},
		{
			// kubernetes pulls in the test-cluster jobs, which are gated on
			// the provider name rather than on any config flag.
			name:     "native kubernetes",
			template: "native",
			config: routerConfig{
				Provider: "kubernetes",
				Template: "native",
				Lint:     true,
				GCP:      true,
				ESC:      routerESCConfig{Enabled: true},
			},
			repo:  "pulumi/pulumi-kubernetes",
			flows: []string{"build.yml", "prerelease.yml", "release.yml"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := routerGenerate(t, tc.template, routerTestConfig(t, tc.config))
			for _, flow := range tc.flows {
				t.Run(flow, func(t *testing.T) {
					assertRepositoryGuards(t, routerWorkflow(t, dir, flow), tc.repo)
				})
			}
		})
	}
}

// TestRouterTestMasterAndReleaseWorkflows asserts that testMasterAndReleaseWorkflows
// adds a pull_request trigger to ci.yml and that the route job's `all` target
// fans out to every flow, while the default keeps pull requests out of ci.yml.
func TestRouterTestMasterAndReleaseWorkflows(t *testing.T) {
	for _, enabled := range []bool{true, false} {
		t.Run(fmt.Sprintf("enabled=%v", enabled), func(t *testing.T) {
			config := routerTestConfig(t, routerConfig{
				Provider:                      "aws",
				ProviderDefaultBranch:         "master",
				TestMasterAndReleaseWorkflows: enabled,
				ESC:                           routerESCConfig{Enabled: true},
			})
			ci := routerWorkflow(t, routerGenerate(t, "bridged-provider", config), "ci.yml")

			var parsed routerWorkflowData
			require.NoError(t, yaml.Unmarshal([]byte(ci), &parsed), "parsing ci.yml")

			_, hasPullRequest := parsed.On["pull_request"]
			assert.Equal(t, enabled, hasPullRequest, "pull_request trigger")
			for _, flow := range []string{"main", "prerelease", "release"} {
				job, exists := parsed.Jobs[flow]
				require.True(t, exists, "missing job %s", flow)
				assert.Contains(t, job.If, "needs.route.outputs.target == 'all'",
					"job %s must run for target all", flow)
			}
		})
	}
}
