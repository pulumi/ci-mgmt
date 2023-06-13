package pkg

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/Masterminds/sprig"
	"github.com/imdario/mergo"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/logging"
	"gopkg.in/yaml.v3"
)

// all includes _ and . prefixed files and directories, e.g.: .github
//
//go:embed all:_/templates
var templateFS embed.FS

var templateRoot = filepath.Join("_", "templates")

type GenerateOpts struct {
	Name           string // e.g.: pulumi/pulumi-aws
	OutDir         string
	TemplateName   string // path inside templates, e.g.: bridged-provider
	Config         []byte // .yaml file containing template config
	ExecuteScripts bool   // Whether to trust the template and run scripts. Opt-out for built-in templates.
}

// Creates a command with a working directory set to the output directory.
func (opts GenerateOpts) Command(name string, arg ...string) *exec.Cmd {
	cmd := exec.Command(name, arg...)
	cmd.Dir = opts.OutDir
	return cmd
}

// Creates a command with a working directory set to dir relative to the output directory.
func (opts GenerateOpts) CommandIn(dir string, name string, arg ...string) *exec.Cmd {
	cmd := exec.Command(name, arg...)
	cmd.Dir = path.Join(opts.OutDir, dir)
	return cmd
}

// Data exposed to text/template that can be referenced in the template code.
type templateContext struct {
	Name       string
	Module     string
	Repository string
	Config     map[string]interface{}

	// Adding a foo.splice file will generate a "foo" entry in this map with the value being the
	// result of rendering foo.splice template.
	Splices map[string]string
}

func GeneratePackage(ctx context.Context, opts GenerateOpts) error {
	if templates, has := TemplateDependencies[opts.TemplateName]; has {
		// Copy opts
		for _, dep := range templates {
			o := opts
			o.TemplateName = dep
			err := GeneratePackage(ctx, o)
			if err != nil {
				return fmt.Errorf("error applying template dependency %s: %w", dep, err)
			}
			logging.GetLogger(ctx).InfoContext(ctx, "Applied template dependency", "dependency", dep)
		}
	}

	templateName := opts.TemplateName
	if alias, has := TemplateAliases[opts.TemplateName]; has {
		templateName = alias
	}

	// Template context is global and loaded from the file at opts.configPath
	// The embedded filesystem templateFS should contain a subdirectory with the name of opts.templateName
	// For each file in the subdirectory, apply templating and write to opts.outDir with the same relative path
	// e.g.: bridged-provider/foo/bar.yaml -> $outDir/foo/bar.yaml

	// Templates have access to .name and .config contexts.
	// .name is opts.packageName
	// .config is the unmarshalled YAML content of opts.configPath

	if !HasTemplate(templateName) {
		return fmt.Errorf("template %s not found", templateName)
	}

	var config map[string]interface{}

	configBytes, err := templateFS.ReadFile(filepath.Join(templateRoot, templateName+".config.yaml"))
	if err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("error reading embedded config file for template %s: %w", templateName, err)
		}
	} else {
		err = yaml.Unmarshal(configBytes, &config)
		if err != nil {
			return fmt.Errorf("error parsing embedded config file for template %s: %w", templateName, err)
		}
	}

	if opts.Config != nil {
		var localConfig map[string]interface{}
		err = yaml.Unmarshal(opts.Config, &localConfig)
		if err != nil {
			return err
		}
		err = mergo.Merge(&config, &localConfig, mergo.WithOverride)
		if err != nil {
			return err
		}
	}

	// We expect that a module git.example/foo/pulumi-bar should have:
	var module string     // github.com/foo/pulumi-bar
	var repository string // foo/pulumi-bar

	name := opts.Name // bar

	// The Name field of opts is either a GitHub org/repo name, or just a provider name.
	if orgName, repoName, matches := strings.Cut(opts.Name, "/"); matches {
		// Treat as GitHub org
		name, matches = strings.CutPrefix(repoName, "pulumi-")
		if !matches {
			return fmt.Errorf("repo name %s does not start with pulumi-", repoName)
		}
		module = fmt.Sprintf("github.com/%s/%s", orgName, repoName)
		repository = fmt.Sprintf("%s/%s", orgName, repoName)

		if repoName != fmt.Sprintf("pulumi-%s", name) {
			return fmt.Errorf("repository name %q must match config provider name %q", repoName, name)
		}
	} else {
		// Else, we require a "repository" config value, and the Name field of opts is the provider name
		name = opts.Name
		// The repository value will be a Go module path, like gitlab.com/example/pulumi-example
		if config["module"] == nil {
			return fmt.Errorf("config must contain a module value")
		}
		module = config["module"].(string)

		parts := strings.Split(module, "/")
		if len(parts) < 3 {
			return fmt.Errorf("module value %q must be a Go module path, i.e.: example.com/foo/pulumi-bar", module)
		}

		repository = parts[len(parts)-2] + "/" + parts[len(parts)-1]
	}

	if config["provider"] != nil && name != config["provider"] {
		return fmt.Errorf("repository name %q must end with config provider name %q, remove the config field or change the value", opts.Name, config["provider"])
	}

	if config["module"] == nil {
		config["module"] = module
	}
	if config["provider"] == nil {
		config["provider"] = name
	}

	if config["upstreamModule"] == nil {
		config["upstreamModule"] = fmt.Sprintf("github.com/%s/%s", config["upstreamOrg"], config["upstreamRepo"])
	}

	tc := templateContext{
		Name:       name,
		Module:     module,
		Repository: repository,
		Config:     config,
	}

	templateDir := filepath.Join(templateRoot, templateName)

	tc.Splices, err = collectSplices(templateDir, tc)
	if err != nil {
		return err
	}

	err = applyTemplateToDir(opts, templateDir, tc)
	if err != nil {
		return err
	}

	if opts.ExecuteScripts {
		err = executePostFns(ctx, opts, tc)
		if err != nil {
			return err
		}
	}

	return nil
}

func applyTemplateToDir(opts GenerateOpts, templateDir string, tc templateContext) error {
	return fs.WalkDir(templateFS, templateDir, func(path string, d fs.DirEntry, err error) error {
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
			branchName := fmt.Sprint(tc.Config["providerDefaultBranch"])
			outPath = strings.ReplaceAll(outPath, "main", branchName)
		}
		templateData, err := fs.ReadFile(templateFS, inPath)

		if err != nil {
			return fmt.Errorf("error reading template %s: %w", inPath, err)
		}

		tmpl, err := renderTemplate(inPath, templateData, tc)
		if err != nil {
			return fmt.Errorf("error parsing template %s: %w", inPath, err)
		}

		// Render the output path as a template
		if strings.Contains(outPath, "#{{") && strings.Contains(outPath, "}}#") {
			outPathBuf, err := renderTemplate(outPath, []byte(outPath), tc)
			if err != nil {
				return fmt.Errorf("error parsing output path template %s: %w", outPath, err)
			}
			outPath = outPathBuf.String()
		}

		// If the outPath ends with /go.mod_, remove the trailing _
		if filepath.Base(outPath) == "go.mod_" {
			outPath = strings.TrimSuffix(outPath, "_")
		}

		err = writeTemplateFile(tmpl, outPath, tc)
		if err != nil {
			return fmt.Errorf("error rendering template %s: %w", inPath, err)
		}
		return nil
	})
}

func executePostFns(ctx context.Context, opts GenerateOpts, tc templateContext) error {
	if fns, ok := PostGenerateFns[opts.TemplateName]; ok {
		for _, fn := range fns {
			err := fn(ctx, opts, tc.Config)
			if err != nil {
				return err
			}
		}
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
		templateData, err := fs.ReadFile(templateFS, path)
		if err != nil {
			return fmt.Errorf("error reading template %s: %w", path, err)
		}

		buf, err := renderTemplate(path, templateData, tc)
		if err != nil {
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
	dirEntries, err := templateFS.ReadDir(templateRoot)
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

func renderTemplate(name string, data []byte, tc templateContext) (bytes.Buffer, error) {
	tmpl, err := template.New(name).Funcs(template.FuncMap{
		"toYaml": toYAML,
	}).Funcs(sprig.FuncMap()).Delims("#{{", "}}#").Parse(string(data))
	if err != nil {
		return bytes.Buffer{}, err
	}

	var outData bytes.Buffer
	err = tmpl.Execute(&outData, tc)
	if err != nil {
		return bytes.Buffer{}, err
	}

	return outData, nil
}

func writeTemplateFile(data bytes.Buffer, outPath string, tc templateContext) error {
	if data.Len() == 0 {
		return nil
	}

	err := os.MkdirAll(filepath.Dir(outPath), 0755)
	if err != nil {
		return err
	}

	outFile, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, &data)
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

func toYAML(v interface{}) (string, error) {
	data, err := yaml.Marshal(v)
	if err != nil {
		return "", err
	}
	return strings.TrimSuffix(string(data), "\n"), nil
}
