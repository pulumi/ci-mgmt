package pkg

import (
	"bytes"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/Masterminds/sprig"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/contract"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/migrations"
	"gopkg.in/yaml.v3"
)

// all includes _ and . prefixed files and directories, e.g.: .github
//
//go:embed all:templates
var templateFS embed.FS

type GenerateOpts struct {
	RepositoryName string // e.g.: pulumi/pulumi-aws
	OutDir         string
	TemplateName   string // path inside templates, e.g.: bridged-provider
	Config         Config // .yaml file containing template config
	SkipMigrations bool
}

// Data exposed to text/template that can be referenced in the template code.
type templateContext struct {
	Repository  string
	ProjectName string // e.g.: pulumi-aws (this is the name of the repository)
	Config      interface{}

	// Adding a foo.splice file will generate a "foo" entry in this map with the value being the
	// result of rendering foo.splice template.
	Splices map[string]string
}

func GeneratePackage(opts GenerateOpts) error {
	templateDirs, err := getTemplateDirs(opts.TemplateName)
	if err != nil {
		return fmt.Errorf("error getting template directories: %w", err)
	}

	// GenName defaults to "tfgen" for bridged providers and "gen" for others
	if opts.Config.GenName == "" {
		switch opts.TemplateName {
		case "generic":
			opts.Config.GenName = "gen"
		default:
			opts.Config.GenName = "tfgen"
		}
	}

	if opts.Config.ToolVersions.PulumiCTL == "" {
		opts.Config.ToolVersions.PulumiCTL = defaultPulumiCTLVersion
	}

	if opts.Config.TestFolder == "" {
		opts.Config.TestFolder = "examples"
	}

	// Clean up old workflows if requested
	if opts.Config.CleanGithubWorkflows {
		err := cleanGithubWorkflows(opts.OutDir, opts.Config.Provider)
		if err != nil {
			return err
		}
	}
	// Clean up files which are marked for deletion
	for _, deletedFile := range getDeletedFiles(opts.TemplateName) {
		err = os.RemoveAll(filepath.Join(opts.OutDir, deletedFile))
		if err != nil {
			return fmt.Errorf("error deleting file %s: %w", deletedFile, err)
		}
	}
	for _, templateDir := range templateDirs {
		err = renderTemplateDir(templateDir, opts)
		if err != nil {
			return fmt.Errorf("error rendering template %s: %w", templateDir, err)
		}
	}
	if !opts.SkipMigrations {
		// Run any relevant migrations
		err = migrations.Migrate(opts.TemplateName, opts.OutDir)
		if err != nil {
			return fmt.Errorf("error running migrations: %w", err)
		}
	}

	return nil
}

func cleanGithubWorkflows(outDir string, providerName string) error {
	workflows, err := os.ReadDir(filepath.Join(outDir, ".github", "workflows"))
	if err != nil {
		if os.IsNotExist(err) {
			// No workflows to clean up
			return nil
		}
		return fmt.Errorf("error reading .github/workflows directory: %w", err)
	}

	for _, workflow := range workflows {
		// Skip provider-specific workflows which are prefixed with the provider name
		if strings.HasPrefix(workflow.Name(), providerName+"-") {
			continue
		}
		err = os.Remove(filepath.Join(outDir, ".github", "workflows", workflow.Name()))
		if err != nil {
			return fmt.Errorf("error deleting workflow %s: %w", workflow.Name(), err)
		}
	}
	return nil
}

func getDeletedFiles(templateName string) []string {
	switch templateName {
	case "bridged-provider":
		return []string{
			".github/actions/download-bin/action.yml",
			".github/actions/download-codegen/action.yml",
			".github/workflows/check-upstream-upgrade.yml",
			".github/workflows/resync-build.yml",
			"upstream.sh",
			".goreleaser.yml",
			".goreleaser.prerelease.yml",
			".github/actions/setup-tools",
			"scripts/plugins.mk",
		}
	case "external-bridged-provider":
		return []string{
			".github/actions/download-bin/action.yml",
			".github/actions/download-codegen/action.yml",
			"upstream.sh",
			".goreleaser.yml",
			".goreleaser.prerelease.yml",
			".github/actions/setup-tools",
			"scripts/plugins.mk",
		}
	case "generic":
		return []string{
			".upgrade-config.yml", // Previously accidentally generated empty file.
			".github/actions/setup-tools",
			"scripts/plugins.mk",
		}
	case "parameterized-go":
		return []string{
			".github/actions/setup-tools",
			"scripts/plugins.mk",
		}
	default:
		return nil
	}
}

func renderTemplateDir(template TemplateDir, opts GenerateOpts) error {
	// Template context is global and loaded from the file at opts.configPath
	// The embedded filesystem templateFS should contain a subdirectory with the name of opts.templateName
	// For each file in the subdirectory, apply templating and write to opts.outDir with the same relative path
	// e.g.: bridged-provider/foo/bar.yaml -> $outDir/foo/bar.yaml

	// Templates have access to .name and .config contexts.
	// .name is opts.packageName
	// .config is the unmarshalled YAML content of opts.configPath

	if !HasTemplate(template) {
		return fmt.Errorf("template %s not found", template)
	}

	config := opts.Config

	projName := strings.TrimPrefix(opts.RepositoryName, "pulumi/")

	if projName == "pulumi-provider-boilerplate" {
		config.ModulePath = "."
	}

	ctx := templateContext{
		Repository:  opts.RepositoryName,
		ProjectName: projName,
		Config:      config,
	}

	templateDir := filepath.Join("templates", string(template))

	var err error
	ctx.Splices, err = collectSplices(templateDir, ctx)
	if err != nil {
		return err
	}

	err = fs.WalkDir(templateFS, templateDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".splice") {
			return nil
		}
		inPath := path
		outPath, err := filepath.Rel(templateDir, path)
		if err != nil {
			return err
		}
		outPath = filepath.Join(opts.OutDir, outPath)
		// Sub in the correct Workflow name by repo default branch
		if strings.Contains(inPath, "main.yml") {
			branchName := config.ProviderDefaultBranch
			outPath = strings.ReplaceAll(outPath, "main", branchName)
		}
		tmpl, err := parseTemplate(templateFS, inPath)
		if err != nil {
			return fmt.Errorf("error parsing template %s: %w", inPath, err)
		}

		err = renderTemplateFile(tmpl, outPath, ctx)
		if err != nil {
			return fmt.Errorf("error rendering template %s: %w", inPath, err)
		}
		return nil
	})
	if err != nil {
		return err
	}

	return nil
}

func collectSplices(templateDir string, tc templateContext) (map[string]string, error) {
	splices := map[string]string{}
	err := fs.WalkDir(templateFS, templateDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".splice") {
			return nil
		}
		tmpl, err := parseTemplate(templateFS, path)
		if err != nil {
			return fmt.Errorf("error parsing template %s: %w", path, err)
		}
		var buf bytes.Buffer
		if err := tmpl.Execute(&buf, tc); err != nil {
			return fmt.Errorf("error rendering template %s: %w", path, err)
		}
		splices[strings.TrimSuffix(filepath.Base(path), ".splice")] = buf.String()
		return nil
	})
	if err != nil {
		return nil, err
	}
	return splices, nil
}

func ListTemplates() ([]TemplateDir, error) {
	dirEntries, err := templateFS.ReadDir("templates")
	if err != nil {
		return nil, err
	}
	var templateNames []TemplateDir
	for _, dirEntry := range dirEntries {
		if dirEntry.IsDir() {
			templateNames = append(templateNames, TemplateDir(dirEntry.Name()))
		}
	}
	return templateNames, nil
}

func HasTemplate(name TemplateDir) bool {
	templates, err := ListTemplates()
	if err != nil {
		return false
	}
	for _, template := range templates {
		if template == name {
			return true
		}
	}
	return false
}

func renderTemplateFile(tmpl *template.Template, outPath string, ctx templateContext) error {
	var outData bytes.Buffer
	err := tmpl.Execute(&outData, ctx)
	if err != nil {
		return err
	}

	if outData.Len() == 0 {
		return nil
	}

	err = os.MkdirAll(filepath.Dir(outPath), 0o755)
	if err != nil {
		return err
	}

	outFile, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer contract.IgnoreError(outFile.Close)

	_, err = io.Copy(outFile, &outData)
	if err != nil {
		return err
	}

	// Make shell scripts executable
	if strings.HasSuffix(outPath, ".sh") {
		err = os.Chmod(outPath, 0o755)
		if err != nil {
			return err
		}
	}
	return nil
}

func parseTemplate(fsys fs.FS, inPath string) (*template.Template, error) {
	inData, err := fs.ReadFile(fsys, inPath)
	if err != nil {
		return nil, err
	}

	tmpl, err := template.New(inPath).Funcs(template.FuncMap{
		"toYaml":           toYAML,
		"renderEscStep":    renderESCStep,
		"renderGlobalEnv":  renderGlobalEnv,
		"renderLocalEnv":   renderLocalEnv,
		"renderPublishEnv": renderPublishEnv,
	}).Funcs(sprig.FuncMap()).Delims("#{{", "}}#").Parse(string(inData))
	if err != nil {
		return nil, err
	}
	return tmpl, nil
}

func toYAML(v interface{}) (string, error) {
	data, err := yaml.Marshal(v)
	if err != nil {
		return "", err
	}
	return strings.TrimSuffix(string(data), "\n"), nil
}

// renderESCStep generates either the real ESC action or our shim action which
// re-exports the existing environment.
func renderESCStep(v any) (string, error) {
	config, ok := v.(Config)
	if !ok {
		return "", fmt.Errorf("expected Config input, got %+v", v)
	}

	yaml := func(v any) (string, error) {
		s, err := toYAML([]any{v})
		return "\n" + s, err
	}

	if !config.ESC.Enabled {
		return "", fmt.Errorf("`esc: { enabled: true } is required for Pulumi providers`")
	}

	env := map[string]string{
		"ESC_ACTION_OIDC_AUTH":                    "true",
		"ESC_ACTION_OIDC_ORGANIZATION":            "pulumi",
		"ESC_ACTION_OIDC_REQUESTED_TOKEN_TYPE":    "urn:pulumi:token-type:access_token:organization",
		"ESC_ACTION_ENVIRONMENT":                  config.ESC.Environment,
		"ESC_ACTION_EXPORT_ENVIRONMENT_VARIABLES": "false",
	}
	step := map[string]any{
		"name": "Fetch secrets from ESC",
		"id":   "esc-secrets",
		"uses": "pulumi/esc-action@9eb774255b1a4afb7855678ae8d4a77359da0d9b",
		"env":  env,
	}
	return yaml(step)
}

// renderGlobalEnv is used to generate environment variables shared by all
// jobs/steps in a non-publishing workflow.
//
// If ESC is disabled, the environment from ci-mgmt.yml is returned as-is. This
// preserves pre-ESC behavior where secrets were (over-)exposed to all steps.
//
// If ESC is enabled, then this will return only non-secret env vars.
// renderLocalEnv is then responsible for consuming those secrets from ESC and
// referencing them from test steps.
//
// Refs https://github.com/pulumi/ci-mgmt/issues/1481.
func renderGlobalEnv(v any) (string, error) {
	config, ok := v.(Config)
	if !ok {
		return "", fmt.Errorf("expected Config input, got %+v", v)
	}

	env := map[string]string{}

	if !config.ESC.Enabled {
		env = map[string]string{
			"PULUMI_PROVIDER_AUTOMATION_TOKEN": "${{ secrets.PULUMI_PROVIDER_AUTOMATION_TOKEN }}",
		}

		if config.Organization == "pulumi" {
			env["AWS_CORP_S3_UPLOAD_ACCESS_KEY_ID"] = "${{ secrets.AWS_CORP_S3_UPLOAD_ACCESS_KEY_ID }}"
			env["AWS_CORP_S3_UPLOAD_SECRET_ACCESS_KEY"] = "${{ secrets.AWS_CORP_S3_UPLOAD_SECRET_ACCESS_KEY }}"
			env["CODECOV_TOKEN"] = "${{ secrets.CODECOV_TOKEN }}"
			env["PULUMI_BOT_TOKEN"] = "${{ secrets.PULUMI_BOT_TOKEN }}"
			env["RELEASE_BOT_ENDPOINT"] = "${{ secrets.RELEASE_BOT_ENDPOINT }}"
			env["RELEASE_BOT_KEY"] = "${{ secrets.RELEASE_BOT_KEY }}"
			env["S3_COVERAGE_BUCKET_NAME"] = "${{ secrets.S3_COVERAGE_BUCKET_NAME }}"
			env["SLACK_WEBHOOK_URL"] = "${{ secrets.SLACK_WEBHOOK_URL }}"
		}
	}

	for k, v := range config.Env {
		if config.ESC.Enabled && strings.Contains(v, "secrets.") {
			continue // Omit secrets from the global env.
		}
		env[k] = v
	}

	// Enable PULUMI_PULUMI_ENABLE_JOURNALING=true globally for all workflows.
	// Part of the rollout of https://github.com/pulumi/pulumi/issues/13502.
	env["PULUMI_PULUMI_ENABLE_JOURNALING"] = "true"

	return toYAML(env)
}

// renderPublishEnv is used to generate environment variables shared by all
// jobs/steps in a publishing workflow.
//
// It differs from renderGlobalEnv only in that additional publishing secrets
// are included by default when ESC is disabled.
//
// Refs https://github.com/pulumi/ci-mgmt/issues/1481.
func renderPublishEnv(v any) (string, error) {
	config, ok := v.(Config)
	if !ok {
		return "", fmt.Errorf("expected Config input, got %+v", v)
	}

	env := map[string]string{}

	if !config.ESC.Enabled {
		env = map[string]string{
			"JAVA_SIGNING_KEY_ID":   "${{ secrets.JAVA_SIGNING_KEY_ID }}",
			"JAVA_SIGNING_KEY":      "${{ secrets.JAVA_SIGNING_KEY }}",
			"JAVA_SIGNING_PASSWORD": "${{ secrets.JAVA_SIGNING_PASSWORD }}",
			"NPM_TOKEN":             "${{ secrets.NPM_TOKEN }}",
			"NUGET_PUBLISH_KEY":     "${{ secrets.NUGET_PUBLISH_KEY }}",
			"OSSRH_PASSWORD":        "${{ secrets.OSSRH_PASSWORD }}",
			"OSSRH_USERNAME":        "${{ secrets.OSSRH_USERNAME }}",
			"PYPI_API_TOKEN":        "${{ secrets.PYPI_API_TOKEN }}",
		}

		if config.Organization == "pulumi" {
			env["AWS_SECRET_ACCESS_KEY"] = "${{ secrets.AWS_SECRET_ACCESS_KEY }}"
			env["AWS_ACCESS_KEY_ID"] = "${{ secrets.AWS_ACCESS_KEY_ID }}"
			env["AWS_UPLOAD_ROLE_ARN"] = "${{ secrets.AWS_UPLOAD_ROLE_ARN }}"
			env["CODECOV_TOKEN"] = "${{ secrets.CODECOV_TOKEN }}"
			env["PULUMI_BOT_TOKEN"] = "${{ secrets.PULUMI_BOT_TOKEN }}"
			env["RELEASE_BOT_ENDPOINT"] = "${{ secrets.RELEASE_BOT_ENDPOINT }}"
			env["RELEASE_BOT_KEY"] = "${{ secrets.RELEASE_BOT_KEY }}"
		}
	}

	for k, v := range config.Env {
		if config.ESC.Enabled && strings.Contains(v, "secrets.") {
			continue // Omit secrets from the global env.
		}
		env[k] = v
	}

	return toYAML(env)
}

// renderLocalEnv is responsible for generating more targeted environment variables for use in e.g. test steps.

// If ESC is enabled, environment variables from ci-mgmt.yml are rendered with secrets replaced by
// ESC outputs. Plaintext values are omitted since they are already contained in the global environment.
//
// If ESC is disabled this only passes GITHUB_TOKEN to the step.
//
// Refs https://github.com/pulumi/ci-mgmt/issues/1481.
func renderLocalEnv(v any) (string, error) {
	config, ok := v.(Config)
	if !ok {
		return "", fmt.Errorf("expected Config input, got %+v", v)
	}

	env := map[string]string{
		"GITHUB_TOKEN": "${{ secrets.GITHUB_TOKEN }}",
	}

	if !config.ESC.Enabled {
		return toYAML(env)
	}

	for k, v := range config.Env {
		if !strings.Contains(v, "secrets.") {
			continue // Omit plaintext values already in the global env.
		}
		if k != "GITHUB_TOKEN" && (strings.HasPrefix(v, "${{secrets.") || strings.HasPrefix(v, "${{ secrets.")) {
			fixed := strings.Replace(v, "secrets.", "steps.esc-secrets.outputs.", 1)
			fmt.Fprintf(os.Stderr, "warning: ESC is enabled, correcting '%s: %s' to be '%s: %s'\n", k, v, k, fixed)
			v = fixed
		}
		env[k] = v
	}

	return toYAML(env)
}
