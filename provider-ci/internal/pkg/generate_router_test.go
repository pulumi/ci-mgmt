package pkg

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func routerTestConfig(t *testing.T, yaml string) Config {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, ".ci-mgmt.yaml")
	if err := os.WriteFile(path, []byte(yaml), 0o600); err != nil {
		t.Fatal(err)
	}
	config, err := LoadLocalConfig(path)
	if err != nil {
		t.Fatal(err)
	}
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
	if err != nil {
		t.Fatalf("GeneratePackage(%s): %v", templateName, err)
	}
	return out
}

func routerWorkflow(t *testing.T, dir, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, ".github", "workflows", name))
	if err != nil {
		t.Fatalf("reading %s: %v", name, err)
	}
	return string(data)
}

func TestRouterBridgedProvider(t *testing.T) {
	cases := []struct {
		name       string
		config     string
		template   string
		mainFlow   string
		otherFlows []string
	}{
		{
			name:       "default branch master",
			config:     "provider: aws\nproviderDefaultBranch: master\nesc:\n  enabled: true\n",
			template:   "bridged-provider",
			mainFlow:   "master.yml",
			otherFlows: []string{"prerelease.yml", "release.yml"},
		},
		{
			// pulumiservice, xyz and terraform-module all default to `main`.
			name:       "default branch main",
			config:     "provider: pulumiservice\nproviderDefaultBranch: main\ntemplate: generic\nesc:\n  enabled: true\n",
			template:   "generic",
			mainFlow:   "main.yml",
			otherFlows: []string{"prerelease.yml", "release.yml"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			config := routerTestConfig(t, tc.config)
			dir := routerGenerate(t, tc.template, config)

			ci := routerWorkflow(t, dir, "ci.yml")
			want := []string{
				"uses: ./.github/workflows/" + tc.mainFlow,
				"${{ !github.event.repository.fork }}",
			}
			for _, flow := range tc.otherFlows {
				want = append(want, "uses: ./.github/workflows/"+flow)
			}
			for _, w := range want {
				if !strings.Contains(ci, w) {
					t.Errorf("ci.yml missing %q:\n%s", w, ci)
				}
			}

			for _, flow := range append([]string{tc.mainFlow}, tc.otherFlows...) {
				body := routerWorkflow(t, dir, flow)
				if !strings.Contains(body, "workflow_call") {
					t.Errorf("%s is not a reusable workflow:\n%s", flow, body)
				}
				if strings.Contains(body, "\n  push:") {
					t.Errorf("%s still declares a push trigger:\n%s", flow, body)
				}
			}
		})
	}
}

func TestRouterNativeProvider(t *testing.T) {
	config := routerTestConfig(t, "provider: docker-build\ntemplate: native\nesc:\n  enabled: true\n")
	dir := routerGenerate(t, "native", config)

	ci := routerWorkflow(t, dir, "ci.yml")
	for _, want := range []string{
		"uses: ./.github/workflows/build.yml",
		"- feature-**",
		"'!CHANGELOG.md'",
	} {
		if !strings.Contains(ci, want) {
			t.Errorf("native ci.yml missing %q:\n%s", want, ci)
		}
	}

	for _, flow := range []string{"build.yml", "prerelease.yml", "release.yml"} {
		body := routerWorkflow(t, dir, flow)
		if !strings.Contains(body, "workflow_call") {
			t.Errorf("%s is not a reusable workflow:\n%s", flow, body)
		}
		if strings.Contains(body, "\n  push:") {
			t.Errorf("%s still declares a push trigger:\n%s", flow, body)
		}
	}
}

// routerNeeds accepts either a scalar or a sequence, matching the two shapes
// GitHub Actions allows for a job's `needs:` key.
type routerNeeds []string

func (n *routerNeeds) UnmarshalYAML(node *yaml.Node) error {
	switch node.Kind {
	case yaml.ScalarNode:
		var single string
		if err := node.Decode(&single); err != nil {
			return err
		}
		*n = routerNeeds{single}
		return nil
	case yaml.SequenceNode:
		var many []string
		if err := node.Decode(&many); err != nil {
			return err
		}
		*n = many
		return nil
	default:
		return fmt.Errorf("unsupported needs node kind %v", node.Kind)
	}
}

type routerJob struct {
	If    string      `yaml:"if"`
	Needs routerNeeds `yaml:"needs"`
}

type routerWorkflowJobs struct {
	Jobs map[string]routerJob `yaml:"jobs"`
}

// ungatedJobs returns the jobs in workflow that are not gated, directly or
// transitively via `needs:`, on the calling repository being repo.
//
// A job whose `if:` uses always() is only considered gated when it carries the
// guard itself: always() makes a job run even when everything it needs was
// skipped, so the `needs:` cascade does not reach it.
func ungatedJobs(t *testing.T, workflow, repo string) []string {
	t.Helper()

	var parsed routerWorkflowJobs
	if err := yaml.Unmarshal([]byte(workflow), &parsed); err != nil {
		t.Fatalf("parsing workflow: %v", err)
	}
	if len(parsed.Jobs) == 0 {
		t.Fatal("workflow declares no jobs")
	}

	guard := "github.repository == '" + repo + "'"

	// gated is memoised; a job under evaluation is recorded as false so that a
	// (malformed) needs cycle terminates instead of recursing forever.
	gated := map[string]bool{}
	var isGated func(name string) bool
	isGated = func(name string) bool {
		if seen, ok := gated[name]; ok {
			return seen
		}
		gated[name] = false
		job, ok := parsed.Jobs[name]
		if !ok {
			return false
		}
		if strings.Contains(job.If, guard) {
			gated[name] = true
			return true
		}
		if strings.Contains(job.If, "always()") {
			return false
		}
		for _, need := range job.Needs {
			if isGated(need) {
				gated[name] = true
				return true
			}
		}
		return false
	}

	var ungated []string
	for name := range parsed.Jobs {
		if !isGated(name) {
			ungated = append(ungated, name)
		}
	}
	sort.Strings(ungated)
	return ungated
}

// TestReusableFlowsGuardRepository asserts that every job in the reusable
// release flows is gated on the calling repository. The flows are
// workflow_call-only and the provider repositories are public, so any other
// repository can invoke them; an ungated job would run there with real
// credentials while the run still reported success.
func TestReusableFlowsGuardRepository(t *testing.T) {
	cases := []struct {
		name     string
		template string
		config   string
		repo     string
		flows    []string
	}{
		{
			name:     "bridged",
			template: "bridged-provider",
			config:   "provider: aws\nproviderDefaultBranch: master\nlint: true\nesc:\n  enabled: true\n",
			repo:     "pulumi/pulumi-aws",
			flows:    []string{"master.yml", "prerelease.yml", "release.yml"},
		},
		{
			name:     "native",
			template: "native",
			config:   "provider: docker-build\ntemplate: native\nlint: true\nesc:\n  enabled: true\n",
			repo:     "pulumi/pulumi-docker-build",
			flows:    []string{"build.yml", "prerelease.yml", "release.yml"},
		},
		{
			// kubernetes pulls in the test-cluster jobs, which are gated on
			// the provider name rather than on any config flag.
			name:     "native kubernetes",
			template: "native",
			config:   "provider: kubernetes\ntemplate: native\nlint: true\ngcp: true\nesc:\n  enabled: true\n",
			repo:     "pulumi/pulumi-kubernetes",
			flows:    []string{"build.yml", "prerelease.yml", "release.yml"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := routerGenerate(t, tc.template, routerTestConfig(t, tc.config))
			for _, flow := range tc.flows {
				body := routerWorkflow(t, dir, flow)
				if ungated := ungatedJobs(t, body, tc.repo); len(ungated) > 0 {
					t.Errorf("%s/%s: jobs are not gated on github.repository == %q, "+
						"neither directly nor through needs: %s",
						tc.template, flow, tc.repo, strings.Join(ungated, ", "))
				}
			}
		})
	}
}
