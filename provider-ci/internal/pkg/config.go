package pkg

import (
	_ "embed" // For embedding action versions.

	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

//go:embed action-versions.yml
var defaultActionVersions []byte

// Config describes the shape of .ci-mgmt.yaml files.
type Config struct {
	// Provider is required and is the name of the provider without the "pulumi-" prefix.
	Provider string `yaml:"provider"`

	// Repository is the optional repository of the provider.
	Repository string `yaml:"repository"`

	// Template names can be found in the getTemplateDirs function in provider-ci/internal/pkg/generate.go.
	Template string `yaml:"template"`

	// Organization is the name of the Github organization the repository lives
	// in. Defaults to 'pulumi'.
	Organization string `yaml:"organization"`

	// MajorVersion of the current provider used in Makefiles. This should
	// always be set by all providers as this is key to go module paths.
	MajorVersion int `yaml:"major-version"`

	// Plugins to install in the "install_plugins" make target. Should be set
	// for all bridged providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22plugins%3A%22&type=code
	Plugins []plugin `yaml:"plugins"`

	// JavaGenVersion ensures a specific javaGen version is used during
	// upgrades if set. Set for 2 providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22javaGenVersion%3A%22&type=code
	JavaGenVersion string `yaml:"javaGenVersion"`

	// UpstreamProviderOrg is optional and used in the bridge upgrade config.
	// Only set for 4 providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22upstreamProviderOrg%3A%22&type=code
	UpstreamProviderOrg string `yaml:"upstreamProviderOrg"`

	// UpstreamProviderRepo is used in the bridge upgrade config. Only set for
	// 5 providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22upstream-provider-repo%22&type=code
	UpstreamProviderRepo string `yaml:"upstream-provider-repo"`

	// Lint includes an extra lint job in workflows if enabled (default). Can
	// be explicitly set to false. This is false in around 8 provider repos:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22lint%3A+false%22&type=code
	Lint bool `yaml:"lint,omitempty"`

	// ProviderDefaultBranch is used to customise the default branch when
	// needed. Currently set in around 17 repos:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22providerDefaultBranch%3A%22&type=code
	ProviderDefaultBranch string `yaml:"providerDefaultBranch"`

	// FailOnMissingMapping sets PULUMI_MISSING_MAPPING_ERROR in the
	// resync-build workflow. Used in alicloud only:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22fail-on-missing-mapping%3A%22&type=code
	FailOnMissingMapping bool `yaml:"fail-on-missing-mapping"`

	// FailOnExtraMapping sets PULUMI_EXTRA_MAPPING_ERROR in resync-build and
	// defaults to true. It is not used:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22fail-on-extra-mapping%3A%22&type=code
	FailOnExtraMapping bool `yaml:"fail-on-extra-mapping"`

	// PublishRegistry decides if create_docs_build happens during release This
	// can be overridden to false to not publish updates. This is disabled in 5
	// repos:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22publishRegistry%3A%22&type=code
	PublishRegistry bool `yaml:"publishRegistry"`

	// CheckoutSubmodules is used for all checkouts during CI. Defaults to
	// false. Only 3 providers use submodules:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22checkoutSubmodules%3A%22&type=code
	CheckoutSubmodules bool `yaml:"checkoutSubmodules"`

	// TestMasterAndReleaseWorkflows runs the master and release workflows on
	// every pull request. This option is currently never set to true:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22testMasterAndReleaseWorkflows%3A%22&type=code
	TestMasterAndReleaseWorkflows bool `yaml:"testMasterAndReleaseWorkflows"`

	// FreeDiskSpaceBeforeBuild when true will clear disk space before running
	// prerequisites workflow. This is used for larger providers which
	// sometimes run out of disk space during builds.
	FreeDiskSpaceBeforeBuild bool `yaml:"freeDiskSpaceBeforeBuild"`

	// FreeDiskSpaceBeforeSdkBuild when true will clear disk space before
	// running test jobs.
	FreeDiskSpaceBeforeSdkBuild bool `yaml:"freeDiskSpaceBeforeSdkBuild"`

	// FreeDiskSpaceBeforeTest when true will clear disk space before running
	// sdk build jobs.
	FreeDiskSpaceBeforeTest bool `yaml:"freeDiskSpaceBeforeTest"`

	// Used for centrally managing tool versions. This is not currently
	// overridden by any providers, but ideally the provider's repository
	// should pin its own tooling:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22toolVersions%22&type=code
	ToolVersions toolVersions `yaml:"toolVersions"`

	// Languages controls which language SDKs get built and published.
	Languages []string `yaml:"languages"`

	// Env contains an assortment of properties for different purposes.
	// Additional entries are added by individual providers for different
	// reasons. All jobs currently get the same env for all steps but values
	// might only be used for very specific purposes.
	Env map[string]string `yaml:"env"`

	// Actions can contain preBuild and preTest additional steps to be spliced
	// into workflows. The use of these hooks vary - quite a few just build
	// upstream and run provider tests. Usage:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22actions%3A%22&type=code
	Actions actions `yaml:"actions"`

	// IntegrationTestProvider will run e2e tests in the provider as well as in
	// the examples directory when set to true. Defaults to false.
	IntegrationTestProvider bool `yaml:"integrationTestProvider"`

	// TestPulumiExamples runs e2e tests using the examples and test suite in
	// the pulumi/examples repo when set to true. Defaults to false. This is
	// unused but potentially useful for azure-native onboarding:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22testPulumiExamples%3A%22&type=code
	TestPulumiExamples bool `yaml:"testPulumiExamples"`

	// Runner defines the runs-on property for various stages of the build
	// These are not overridden by any providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22runner%3A%22&type=code
	Runner struct {
		Default       string `yaml:"default"`
		Prerequisites string `yaml:"prerequisites"`
		BuildSDK      string `yaml:"buildSdk"`
		Publish       string `yaml:"publish"`
	} `yaml:"runner"`

	// actionVersions should be used wherever we use external actions to make
	// upgrading easier. These are never overridden by providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22actionVersions%3A%22&type=code
	ActionVersions actionVersions `yaml:"actionVersions"`

	// Publish contains multiple properties relating to the publish jobs. Used
	// by 2 providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22publish%3A%22&type=code
	Publish publish `yaml:"publish"`

	// RegistryDocs enables automatic registry index doc file generation.
	// Intended for use with Tier 2/3 providers.
	RegistryDocs bool `yaml:"registryDocs"`

	// CheckUpstreamUpgrade determines whether we run the upstream upgrade job
	// for bridged providers. Set to false for providers that cannot be
	// upgraded, e.g. because of archived upstream or a license conflict.
	CheckUpstreamUpgrade bool `yaml:"checkUpstreamUpgrade"`

	// ReleaseVerification optionally enables running example tests during releases.
	ReleaseVerification *releaseVerification `yaml:"releaseVerification,omitempty"`

	// ExtraLDFlags lists extra flags used by build targets. Only used by
	// newrelic:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22extra-ld-flags%22&type=code
	ExtraLDFlags []string `yaml:"extra-ld-flags"`

	// GoBuildParallelism sets PULUMI_PROVIDER_BUILD_PARALLELISM in the
	// Makefile. Used in 5 providers and ideally should be configured by the provider:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22goBuildParallelism%22&type=code
	GoBuildParallelism int `yaml:"goBuildParallelism"`

	// PulumiConvert sets PULUMI_CONVERT to 1 if truthy. PulumiConvert is set
	// to "1" in 74 providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22pulumiConvert%22&type=code
	PulumiConvert intOrBool `yaml:"pulumiConvert"`

	// DocsCmd adds a "docs" target in the makefile. Used only in
	// pulumi-docker:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22docsCmd%3A%22&type=code
	DocsCmd string `yaml:"docsCmd"`

	// XrunUpstreamTools adds extra steps for AWS's upstream make target.
	// https://github.com/pulumi/pulumi-aws/issues/2757
	XrunUpstreamTools bool `yaml:"XrunUpstreamTools"`

	// AWS configures AWS credentials before running tests in CI job. Used in 4
	// providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22aws%3A%22&type=code
	AWS bool `yaml:"aws"`

	// Docker runs testing/docker-compose.yml up before running tests in CI
	// job. Used in 9 providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22docker%3A%22&type=code
	Docker bool `yaml:"docker"`

	// GCP authenticates with GCP before running tests in CI job. Used in gcp
	// and docker:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22gcp%3A%22&type=code
	GCP bool `yaml:"gcp"`

	// GCPRegistry enables logging into the GCP registry before running tests
	// in CI job. Only used for docker:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22gcpRegistry%3A%22&type=code
	GCPRegistry bool `yaml:"gcpRegistry"`

	// SetupScript executes a script before running tests in CI job. Used in 3
	// providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22setup-script%3A%22&type=code
	SetupScript string `yaml:"setup-script"`

	// GenerateNightlyTestWorkflow will include the nightly-test workflow. Used
	// in 11  providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22generate-nightly-test-workflow%3A%22&type=code
	GenerateNightlyTestWorkflow bool `yaml:"generate-nightly-test-workflow"`

	// License lists package paths to ignore when running the license check
	License struct {
		Ignore []string `yaml:"ignore"`
	} `yaml:"license"`

	// CleanGithubWorkflows deletes existing files within the .github/workflows
	// directory, except where the file begins with the name of the provider
	// (e.g. `aws-*`) which are considered provider-specific workflows.
	// Defaults to true but this will likely change to false in the future once
	// we've made the process of cleaning up removed and renamed workflows more
	// reliable.
	CleanGithubWorkflows bool `yaml:"clean-github-workflows"`

	// ProviderVersion controls the path of the version LD flag. Only set for 3
	// providers:
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22providerVersion%3A%22&type=code
	ProviderVersion string `yaml:"providerVersion"`

	// EnableConfigurationCheck prints a warning on PRs if configuration
	// options aren't documented in the README. Only used by civo.
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22enableConfigurationCheck%3A%22&type=code
	EnableConfigurationCheck bool `yaml:"enableConfigurationCheck"`

	// Deprecated configs

	// Parallel has no effect but is set by some providers.
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22parallel%3A%22&type=code
	Parallel int `yaml:"parallel"`

	// Hybrid has no effect but is set by the docker provider.
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22hybrid%3A%22&type=code
	Hybrid bool `yaml:"hybrid"`

	// Team has no effect but is set by some providers.
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22team%3A%22&type=code
	Team string `yaml:"team"`

	// Timeout has no effect but is set by some providers. It can be specified
	// as an int (minutes) or a string duration.
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22timeout%3A%22&type=code
	Timeout intOrDuration `yaml:"timeout"`

	// MakeTemplate has no effect but is set by 78 providers.
	// https://github.com/search?q=org%3Apulumi+path%3A.ci-mgmt.yaml+%22makeTemplate%3A%22&type=code
	MakeTemplate string `yaml:"makeTemplate"`
}

// LoadLocalConfig loads the provider configuration at the given path with
// defaults applied.
func LoadLocalConfig(path string) (Config, error) {
	config, err := loadDefaultConfig()
	if err != nil {
		return Config{}, err
	}

	localConfigBytes, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("error reading config file %s: %w", path, err)
	}

	dec := yaml.NewDecoder(bytes.NewReader(localConfigBytes))
	dec.KnownFields(true)
	err = dec.Decode(&config)
	if err != nil {
		return Config{}, err
	}
	return config, nil
}

type plugin struct {
	Name    string `yaml:"name"`
	Version string `yaml:"version"`
	Kind    string `yaml:"kind"`
}

type actions struct {
	PreTest  any `yaml:"preTest"`
	PreBuild any `yaml:"preBuild"`
}

type actionVersions struct {
	ConfigureAwsCredentials string `yaml:"configureAwsCredentials"`
	SetupGcloud             string `yaml:"setupGcloud"`
	GoogleAuth              string `yaml:"googleAuth"`
	Checkout                string `yaml:"checkout"`
	DownloadArtifact        string `yaml:"downloadArtifact"`
	PathsFilter             string `yaml:"pathsFilter"`
	PrComment               string `yaml:"prComment"`
	UploadArtifact          string `yaml:"uploadArtifact"`
	UpgradeProviderAction   string `yaml:"upgradeProviderAction"`
	FreeDiskSpace           string `yaml:"freeDiskSpace"`
	ProviderVersionAction   string `yaml:"providerVersionAction"`
	Codecov                 string `yaml:"codeCov"`
}

type toolVersions struct {
	Dotnet string `yaml:"dotnet"`
	Go     string `yaml:"go"`
	Java   string `yaml:"java"`
	Gradle string `yaml:"gradle"`
	Nodejs string `yaml:"nodejs"`
	Pulumi string `yaml:"pulumi"`
	Python string `yaml:"python"`
}

type releaseVerification struct {
	Dotnet string `yaml:"dotnet"`
	Go     string `yaml:"go"`
	Nodejs string `yaml:"nodejs"`
	Python string `yaml:"python"`
}

type publish struct {
	PublisherAction string `yaml:"publisherAction"`
	SDK             string `yaml:"sdk"`
	CDN             bool   `yaml:"cdn"`
}

func loadDefaultConfig() (Config, error) {
	var config Config

	// Parse our actions file while preserving comments.
	var doc yaml.Node
	err := yaml.Unmarshal(defaultActionVersions, &doc)
	if err != nil {
		return Config{}, err
	}

	for _, subdoc := range doc.Content {
		for _, jobs := range subdoc.Content {
			for _, job := range jobs.Content {
				for _, steps := range job.Content {
					if steps.Kind != yaml.SequenceNode {
						continue
					}
					for _, step := range steps.Content {
						if len(step.Content) != 4 {
							continue
						}
						name := step.Content[1].Value
						uses := step.Content[3].Value + step.Content[3].FootComment
						if step.Content[3].LineComment != "" {
							uses += " " + step.Content[3].LineComment
						}

						switch name {
						case "aws-actions/configure-aws-credentials":
							config.ActionVersions.ConfigureAwsCredentials = uses
						case "google-github-actions/setup-gcloud":
							config.ActionVersions.SetupGcloud = uses
						case "google-github-actions/auth":
							config.ActionVersions.GoogleAuth = uses
						case "actions/checkout":
							config.ActionVersions.Checkout = uses
						case "actions/download-artifact":
							config.ActionVersions.DownloadArtifact = uses
						case "dorny/paths-filter":
							config.ActionVersions.PathsFilter = uses
						case "thollander/actions-comment-pull-request":
							config.ActionVersions.PrComment = uses
						case "actions/upload-artifact":
							config.ActionVersions.UploadArtifact = uses
						case "pulumi/pulumi-upgrade-provider-action":
							config.ActionVersions.UpgradeProviderAction = uses
						case "jlumbroso/free-disk-space":
							config.ActionVersions.FreeDiskSpace = uses
						case "pulumi/provider-version-action":
							config.ActionVersions.ProviderVersionAction = uses
						case "codecov/codecov-action":
							config.ActionVersions.Codecov = uses
						}
					}
				}
			}
		}
	}

	configBytes, err := templateFS.ReadFile(filepath.Join("templates", "defaults.config.yaml"))
	if err != nil {
		return Config{}, fmt.Errorf("error reading embedded defaults config file: %w", err)
	}

	dec := yaml.NewDecoder(bytes.NewReader(configBytes))
	dec.KnownFields(true)
	err = dec.Decode(&config)
	if err != nil {
		return Config{}, fmt.Errorf("error parsing embedded defaults config file: %w", err)
	}
	return config, nil
}

type intOrBool bool

func (x *intOrBool) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var b bool
	if err := unmarshal(&b); err == nil {
		*x = intOrBool(b)
		return nil
	}

	var i int
	if err := unmarshal(&i); err != nil {
		return fmt.Errorf("unmarshal int: %w", err)
	}

	*x = intOrBool(i == 1)
	return nil
}

type intOrDuration time.Duration

func (x *intOrDuration) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var d time.Duration
	if err := unmarshal(&d); err == nil {
		*x = intOrDuration(d)
		return nil
	}

	var i int64
	if err := unmarshal(&i); err != nil {
		return fmt.Errorf("unmarshal int: %w", err)
	}

	*x = intOrDuration(i * int64(time.Minute))
	return nil
}
