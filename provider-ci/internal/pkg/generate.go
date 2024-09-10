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
	return nil
}

// getTemplateDirs returns a list of directories in the embedded filesystem that form the overall template.
// Each directory is rendered into the same output directory.
// Care should be taken to ensure that the template files do not conflict with each other.
func getTemplateDirs(templateName string) ([]string, error) {
	// Available templates:
	// - provider: the main template for any provider repository
	// - bridged-provider: a template for a provider repository that uses tf-bridge & follows the boilerplate structure.
	// - dev-container: a dev-container setup for any pulumi related project.
	switch templateName {
	case "bridged-provider":
		// Render more specific templates last to allow them to override more general templates.
		return []string{"provider", "dev-container", "bridged-provider"}, nil
	default:
		return nil, fmt.Errorf("unknown template: %s", templateName)
	}
}

func getDeletedFiles(templateName string) []string {
	switch templateName {
	case "bridged-provider":
		return []string{
			"scripts/upstream.sh",
			".goreleaser.yml",
			".goreleaser.prerelease.yml",
		}
	default:
		return nil
	}
}

func renderTemplateDir(template string, opts GenerateOpts) error {
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

	templateDir := filepath.Join("templates", template)

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
			branchName := fmt.Sprint(config["providerDefaultBranch"])
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

func ListTemplates() ([]string, error) {
	dirEntries, err := templateFS.ReadDir("templates")
	if err != nil {
		return nil, err
	}
	var templateNames []string
	for _, dirEntry := range dirEntries {
		if dirEntry.IsDir() {
			templateNames = append(templateNames, dirEntry.Name())
		}
	}
	return templateNames, nil
}

func HasTemplate(name string) bool {
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
		"toYaml": toYAML,
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
