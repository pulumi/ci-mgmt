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
	"github.com/imdario/mergo"
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
	ConfigPath     string // .yaml file containing template config
}

type templateContext struct {
	Repository string
	Config     interface{}
}

func GeneratePackage(opts GenerateOpts) error {
	// Template context is global and loaded from the file at opts.configPath
	// The embedded filesystem templateFS should contain a subdirectory with the name of opts.templateName
	// For each file in the subdirectory, apply templating and write to opts.outDir with the same relative path
	// e.g.: bridged-provider/foo/bar.yaml -> $outDir/foo/bar.yaml

	// Templates have access to .name and .config contexts.
	// .name is opts.packageName
	// .config is the unmarshalled YAML content of opts.configPath

	if !HasTemplate(opts.TemplateName) {
		return fmt.Errorf("template %s not found", opts.TemplateName)
	}

	var config map[string]interface{}

	configBytes, err := templateFS.ReadFile(filepath.Join("templates", opts.TemplateName+".config.yaml"))
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("error reading embedded config file for template %s: %w", opts.TemplateName, err)
		}
	} else {
		err = yaml.Unmarshal(configBytes, &config)
		if err != nil {
			return fmt.Errorf("error parsing embedded config file for template %s: %w", opts.TemplateName, err)
		}
	}

	if opts.ConfigPath != "" {
		localConfigBytes, err := os.ReadFile(opts.ConfigPath)
		if err != nil {
			return fmt.Errorf("error reading config file %s: %w", opts.ConfigPath, err)
		}

		var localConfig map[string]interface{}
		err = yaml.Unmarshal(localConfigBytes, &localConfig)
		if err != nil {
			return err
		}
		err = mergo.Merge(&config, &localConfig, mergo.WithOverride)
		if err != nil {
			return err
		}
	}

	ctx := templateContext{
		Repository: opts.RepositoryName,
		Config:     config,
	}

	templateDir := filepath.Join("templates", opts.TemplateName)
	err = fs.WalkDir(templateFS, templateDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
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
