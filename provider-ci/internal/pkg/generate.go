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
		}
	case "external-bridged-provider":
		return []string{
			".github/actions/download-bin/action.yml",
			".github/actions/download-codegen/action.yml",
			"upstream.sh",
			".goreleaser.yml",
			".goreleaser.prerelease.yml",
		}
	case "generic":
		return []string{
			".upgrade-config.yml", // Previously accidentally generated empty file.
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

	err = os.MkdirAll(filepath.Dir(outPath), 0755)
	if err != nil {
		return err
	}

	outFile, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, &outData)
	if err != nil {
		return err
	}

	// Make shell scripts executable
	if strings.HasSuffix(outPath, ".sh") {
		err = os.Chmod(outPath, 0755)
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
		"toYaml":        toYAML,
		"renderEscStep": renderESCStep,
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

func renderESCStep(v any) (string, error) {
	config, ok := v.(Config)
	if !ok {
		return "", fmt.Errorf("expected Config input, got %+v", v)
	}

	yaml := func(v any) (string, error) {
		s, err := toYAML([]any{v})
		return "\n" + s, err
	}

	if config.ESC.Enabled {
		env := map[string]string{
			"ESC_ACTION_OIDC_AUTH":                 "true",
			"ESC_ACTION_OIDC_ORGANIZATION":         "pulumi",
			"ESC_ACTION_OIDC_REQUESTED_TOKEN_TYPE": "urn:pulumi:token-type:access_token:organization",
			"ESC_ACTION_ENVIRONMENT":               config.ESC.Environment,
		}
		if len(config.ESC.EnvironmentVariables) > 0 {
			env["ESC_ACTION_EXPORT_ENVIRONMENT_VARIABLES"] = strings.Join(config.ESC.EnvironmentVariables, ",\n")

		}
		step := map[string]any{
			"name": "Fetch secrets from ESC",
			"id":   "esc-secrets",
			"uses": "./.github/actions/esc-action",
			"env":  env,
		}
		return yaml(step)
	}

	// If ESC is disabled, we use a shim action which pipes environment
	// variables to the action's outputs. This way our steps stay the same
	// regardless of whether ESC is enabled or not.
	return yaml(map[string]any{
		"name": "Fetch secrets from ESC",
		"id":   "esc-secrets",
		"uses": "./.github/actions/esc-action",
	})
}
