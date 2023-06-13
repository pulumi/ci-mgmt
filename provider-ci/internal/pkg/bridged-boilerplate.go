package pkg

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/mitchellh/mapstructure"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/logging"
)

func init() {
	PostGenerateFns["bridged-boilerplate"] = []PostGenerateFunc{postBridgedBoilerplate}
	TemplateDependencies["bridged-boilerplate"] = []string{"bridged-provider"}

	// bridged-boilerplate-shims regenerates shims and applies the template, and does not initialize a
	// git repo, upstream fork, etc.
	PostGenerateFns["bridged-boilerplate-shims"] = []PostGenerateFunc{postBridgedBoilerplateShims}
	TemplateDependencies["bridged-boilerplate-shims"] = []string{"bridged-provider"}
	TemplateAliases["bridged-boilerplate-shims"] = "bridged-boilerplate"
}

type bridgedProviderConfig struct {
	Provider string `mapstructure:"provider"`

	Ref  string `mapstructure:"upstreamRef"`
	Org  string `mapstructure:"upstreamOrg"`
	Repo string `mapstructure:"upstreamRepo"`
	Mod  string `mapstructure:"upstreamModule"`
}

func postBridgedBoilerplateShims(ctx context.Context, opts GenerateOpts, configUntyped interface{}) error {
	logger := logging.GetLogger(ctx)
	var config bridgedProviderConfig
	err := mapstructure.Decode(configUntyped, &config)
	if err != nil {
		return err
	}

	fns, err := findProviderFunctions(ctx, filepath.Join(opts.OutDir, "./upstream"))
	if err != nil {
		return err
	}
	for _, v := range fns {
		logger.DebugContext(ctx, "Found upstream function", "function", v)
	}

	if len(fns) != 0 {
		err = writeShims(ctx, opts, config, fns)
		if err != nil {
			return fmt.Errorf("error writing upstream shims: %w", err)
		}
		err = patchUpstream(opts, config)
		if err != nil {
			return fmt.Errorf("error patching upstream: %w", err)
		}
		logger.DebugContext(ctx, "Patched upstream provider.")
	}
	logger.InfoContext(ctx, "Generated shims", "count", len(fns))

	err = runGoGet(opts)
	if err != nil {
		logger.ErrorContext(ctx, "Error running go get", "error", err)
		return err
	}
	logger.DebugContext(ctx, "Ran go get")

	return nil
}

func postBridgedBoilerplate(ctx context.Context, opts GenerateOpts, configUntyped interface{}) error {
	var config bridgedProviderConfig
	err := mapstructure.Decode(configUntyped, &config)
	if err != nil {
		return err
	}

	err = opts.Command("git", "init").Run()
	if err != nil {
		return err
	}
	logger := logging.GetLogger(ctx)
	logger.DebugContext(ctx, "Initialized empty Git repository")

	err = opts.Command("git", "commit", "--allow-empty", "-m", "Initial commit.").Run()
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Created initial commit")

	err = opts.Command("git", "tag", "v0.0.0").Run()
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Tagged with v0.0.0")

	err = configureUpstreamFork(ctx, opts, config)
	if err != nil {
		logger.ErrorContext(ctx, "Error configuring upstream fork", "error", err)
		return err
	}

	err = runGoGet(opts)
	if err != nil {
		logger.ErrorContext(ctx, "Error running go get", "error", err)
		return err
	}
	logger.DebugContext(ctx, "Ran go get")

	err = opts.Command("git", "add", "--all").Run()
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Added all files to Git")

	err = opts.Command("git", "commit", "-m", "Generate provider.").Run()
	if err != nil {
		return err
	}
	logger.DebugContext(ctx, "Committed generated code")

	return nil
}

func configureUpstreamFork(ctx context.Context, opts GenerateOpts, config bridgedProviderConfig) error {
	logger := logging.GetLogger(ctx)
	err := addSubmodule(opts, config)
	if err != nil {
		return fmt.Errorf("error adding submodule: %w", err)
	}
	logger.DebugContext(ctx, "Added upstream submodule.")

	err = updateGitmodules(opts)
	if err != nil {
		return fmt.Errorf("error updating .gitmodules: %w", err)
	}
	logger.DebugContext(ctx, "Updated .gitmodules.")

	err = setUpstreamRef(ctx, opts, config)
	if err != nil {
		return fmt.Errorf("error checking out latest tag: %w", err)
	}

	fns, err := findProviderFunctions(ctx, filepath.Join(opts.OutDir, "./upstream"))
	if err != nil {
		return err
	}
	if len(fns) > 0 {
		err = writeShims(ctx, opts, config, fns)
		if err != nil {
			return fmt.Errorf("error writing upstream shims: %w", err)
		}
		err = patchUpstream(opts, config)
		if err != nil {
			return fmt.Errorf("error patching upstream: %w", err)
		}
		logger.InfoContext(ctx, "Generated shims", "count", len(fns))
	} else {
		logger.WarnContext(ctx, "No upstream shims found.")
	}

	return nil
}

func addSubmodule(opts GenerateOpts, config bridgedProviderConfig) error {
	upstreamURL := fmt.Sprintf("https://github.com/%s/%s.git", config.Org, config.Repo)
	cmd := opts.Command("git", "submodule", "add", upstreamURL, "upstream")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("error adding submodule: %s: output:\n%s", err, string(output))
	}

	return nil
}

func setUpstreamRef(ctx context.Context, opts GenerateOpts, config bridgedProviderConfig) error {
	ref := config.Ref
	if ref == "" {
		type Tag struct {
			TagName string `json:"tagName"`
		}

		cmd := opts.Command("gh", "release", "view", "--repo", fmt.Sprintf("%s/%s", config.Org, config.Repo), "--json", "tagName")
		output, err := cmd.Output()
		if err != nil {
			return (err)
		}

		var tag Tag
		err = json.Unmarshal(output, &tag)
		if err != nil {
			return err
		}

		ref = tag.TagName
	}

	cmd := opts.CommandIn("upstream", "git", "checkout", ref)
	err := cmd.Run()
	if err != nil {
		return err
	}

	err = opts.Command("git", "add", "upstream").Run()
	if err != nil {
		return err
	}

	logging.GetLogger(ctx).DebugContext(ctx, "Checked out upstream ref", "ref", ref)
	return nil
}

func updateGitmodules(opts GenerateOpts) error {
	content := "\tignore = dirty\n"
	f, err := os.OpenFile(filepath.Join(opts.OutDir, ".gitmodules"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.WriteString(content)
	return err
}

func runGoGet(opts GenerateOpts) error {
	for _, dir := range []string{"provider", "examples"} {
		cmd := opts.CommandIn(dir, "go", "get", "./...")
		cmd.Env = append(os.Environ(), "GOWORK=off")
		cwd, err := os.Getwd()
		if err != nil {
			return err
		}

		output, err := cmd.CombinedOutput()
		if err != nil {
			// get the location of the go binary that ran, i.e.: "which go"
			goBin, err := exec.LookPath("go")
			if err != nil {
				return err
			}
			return fmt.Errorf("error running go (at %q) get in dir %q: %v: output:\n%s", goBin, filepath.Join(cwd, dir), err, string(output))
		}
	}

	return nil
}

type FunctionInfo struct {
	PackagePath string // package path including parent directories
	Package     string
	Name        string
	Call        string
	Kind        string
}

func findProviderFunctions(ctx context.Context, upstreamPath string) ([]FunctionInfo, error) {
	var functions []FunctionInfo

	logger := logging.GetLogger(ctx)

	err := filepath.Walk(upstreamPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if filepath.Base(path) == shimDir {
			return filepath.SkipDir
		}

		if info.IsDir() || !strings.HasSuffix(info.Name(), ".go") {
			return nil
		}

		if strings.HasSuffix(info.Name(), "_test.go") {
			return nil
		}

		logger.DebugContext(ctx, "Parsing file", "path", path)

		fileSet := token.NewFileSet()
		file, err := parser.ParseFile(fileSet, path, nil, parser.SkipObjectResolution)
		if err != nil {
			return err
		}

		pkgs := getProviderSDKPackages(file)
		if len(pkgs) == 0 {
			return nil
		}

		ast.Inspect(file, func(n ast.Node) bool {
			switch x := n.(type) {
			case *ast.FuncDecl:

				info, err := getProviderInfo(ctx, file, x, pkgs)
				if err != nil {
					logging.GetLogger(ctx).ErrorContext(ctx, "Error getting provider info", "error", err)
				}
				if info != nil {
					info.PackagePath = strings.TrimPrefix(filepath.Dir(path), upstreamPath+"/")
					functions = append(functions, *info)
				}
				return false
			}
			return true
		})
		return nil
	})

	if err != nil {
		return nil, err
	}

	return functions, nil
}

type ProviderSDK struct {
	Kind          string            // must be either "sdk-v1", "sdk-v2" or "pf"
	Package       string            // "schema", "provider", etc.
	TypeMatcher   func(string) bool // returns true if the type is a provider type
	TypeAssertion string            // if the provider type must use a type assertion to use in a shim, the type to map to
}

func getProviderSDKPackages(file *ast.File) []ProviderSDK {
	var providers []ProviderSDK
	for _, imp := range file.Imports {
		// For SDK-V1, we accept either a terraform.ResourceProvider or a *schema.Provider
		if imp.Path.Value == `"github.com/hashicorp/terraform-plugin-sdk/terraform"` {
			name := "terraform"
			if imp.Name != nil {
				name = imp.Name.Name
			}
			providers = append(providers, ProviderSDK{
				Kind:    "sdk-v1",
				Package: name,
				TypeMatcher: func(name string) bool {
					return name == "ResourceProvider"
				},
				TypeAssertion: ".(*schema.Provider)",
			})
		}
		if imp.Path.Value == `"github.com/hashicorp/terraform-plugin-sdk/helper/schema"` {
			name := "schema"
			if imp.Name != nil {
				name = imp.Name.Name
			}
			providers = append(providers, ProviderSDK{
				Kind:    "sdk-v1",
				Package: name,
				TypeMatcher: func(name string) bool {
					return name == "Provider" || strings.HasPrefix(name, "ProviderWith")
				},
			})
		}
		if imp.Path.Value == `"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"` {
			name := "schema"
			if imp.Name != nil {
				name = imp.Name.Name
			}
			providers = append(providers, ProviderSDK{
				Kind:    "sdk-v2",
				Package: name,
				TypeMatcher: func(name string) bool {
					return name == "Provider" || strings.HasPrefix(name, "ProviderWith")
				},
			})
		}
		if imp.Path.Value == `"github.com/hashicorp/terraform-plugin-framework/provider"` {
			name := "provider"
			if imp.Name != nil {
				name = imp.Name.Name
			}
			providers = append(providers, ProviderSDK{
				Kind:    "pf",
				Package: name,
				TypeMatcher: func(name string) bool {
					return name == "Provider" || strings.HasPrefix(name, "ProviderWith")
				},
			})
		}
	}
	return providers
}

func getProviderInfo(ctx context.Context, file *ast.File, fn *ast.FuncDecl, sdks []ProviderSDK) (*FunctionInfo, error) {
	if fn.Type.Results == nil || len(fn.Type.Results.List) != 1 {
		return nil, nil
	}

	logger := logging.GetLogger(ctx)

	type CtorInfo struct {
		sdk  ProviderSDK
		call string
	}

	var getConstructor func(expr ast.Expr) (CtorInfo, error)
	getConstructor = func(expr ast.Expr) (CtorInfo, error) {
		switch t := expr.(type) {
		case *ast.SelectorExpr:
			// TODO: we should check if the import is from the right package, i.e.: this if statement
			// should move into the loop over providers
			xIdent, ok := t.X.(*ast.Ident)
			if !ok {
				return CtorInfo{}, nil
			}
			for _, p := range sdks {
				if p.Package == xIdent.Name && p.TypeMatcher(t.Sel.Name) {
					logger.DebugContext(ctx, "Found provider constructor", "package", file.Name.Name, "selector", t.Sel.Name, "name", fn.Name.Name)
					return CtorInfo{
						sdk:  p,
						call: "",
					}, nil
				}
			}
		case *ast.StarExpr:
			ctor, err := getConstructor(t.X)
			// Trust that we want a * return type, e.g.: *schema.Provider
			return ctor, err
		case *ast.FuncType:
			if t.Results != nil && len(t.Results.List) == 1 {
				ctor, err := getConstructor(t.Results.List[0].Type)
				if err != nil {
					return CtorInfo{}, err
				}
				if len(t.Params.List) == 0 {
					ctor.call = "()" + ctor.call
					return ctor, nil
				} else if len(t.Params.List) == 1 {
					// Handle providers where the constructor takes a version argument
					if ident, ok := t.Params.List[0].Type.(*ast.Ident); ok && ident.Name == "string" {
						ctor.call = `("")` + ctor.call
						return ctor, nil
					}
				}
				return CtorInfo{}, fmt.Errorf("unsupported constructor function signature: %v", t)
			}
		default:
		}
		return CtorInfo{}, nil
	}

	ctor, err := getConstructor(fn.Type)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", err, fn.Name.Name)
	}
	if ctor.call == "" || ctor.sdk.Kind == "" {
		return nil, nil
	}

	call := fmt.Sprintf("%s%s%s", fn.Name.Name, ctor.call, ctor.sdk.TypeAssertion)
	logger.InfoContext(ctx, "Found provider function", "package", file.Name.Name, "name", fn.Name.Name, "call", call)

	return &FunctionInfo{
		Kind:    ctor.sdk.Kind,
		Package: file.Name.Name, // Name of package.
		Name:    fn.Name.Name,
		Call:    call,
	}, nil
}

func nodeSprintf(node ast.Node) string {
	var buf bytes.Buffer
	fileSet := token.NewFileSet()
	err := printer.Fprint(&buf, fileSet, node)
	if err != nil {
		return fmt.Sprintf("error formatting node: %v", err)
	}
	return buf.String()
}

const shimDir = "pulumi-shim"

func writeShims(ctx context.Context, opts GenerateOpts, config bridgedProviderConfig, fns []FunctionInfo) error {
	logger := logging.GetLogger(ctx)
	upstreamShimDir := filepath.Join(opts.OutDir, "upstream", shimDir)
	_ = os.RemoveAll(upstreamShimDir)
	err := os.MkdirAll(upstreamShimDir, 0777)
	if err != nil {
		return fmt.Errorf("error creating shim dir: %w", err)
	}

	upstreamModule := config.Mod
	for _, v := range fns {
		filename, content, err := generateUpstreamShim(v, upstreamModule)
		if err != nil {
			return err
		}
		if err != nil {
			return err
		}
		err = os.WriteFile(filepath.Join(upstreamShimDir, filename), []byte(content), 0644)
		if err != nil {
			return err
		}
		logger.DebugContext(ctx, "Generated shim", "function", v.Name, "kind", v.Kind, "filename", filename)
	}
	content, err := generateLocalShim(ctx, config, fns)
	if err != nil {
		return err
	}
	err = os.WriteFile(filepath.Join(opts.OutDir, "provider", "shim.go"), []byte(content), 0644)
	if err != nil {
		return err
	}

	return nil
}

func patchUpstream(opts GenerateOpts, config bridgedProviderConfig) error {
	// Git add
	err := opts.CommandIn("upstream", "git", "add", "pulumi-shim").Run()
	if err != nil {
		return err
	}

	// Generate the patch:
	diffCmd := opts.CommandIn("upstream", "git", "diff", "--cached")
	patchOutput, err := diffCmd.Output()
	if err != nil {
		return err
	}

	// Make patches dir
	patchesDir := filepath.Join(opts.OutDir, "patches")
	err = os.MkdirAll(patchesDir, 0777)
	if err != nil {
		return err
	}

	// Write the patch
	patchFile := filepath.Join(patchesDir, "0000-fork.patch")
	err = os.WriteFile(patchFile, patchOutput, 0644)
	if err != nil {
		return err
	}

	return nil
}

func generateUpstreamShim(functionInfo FunctionInfo, upstreamModule string) (string, string, error) {
	var content string

	if functionInfo.Kind == "sdk-v1" {
		content = fmt.Sprintf(`package shim

import (
	"github.com/hashicorp/terraform-plugin-sdk/helper/schema"
	upstream "%s/%s"
)

func SDKProvider() *schema.Provider {
	return upstream.%s
}
`, upstreamModule, functionInfo.PackagePath, functionInfo.Call)
	} else if functionInfo.Kind == "sdk-v2" {
		content = fmt.Sprintf(`package shim

import (
	"github.com/hashicorp/terraform-plugin-sdk/v2/helper/schema"
	upstream "%s/%s"
)

func SDKProvider() *schema.Provider {
	return upstream.%s
}
`, upstreamModule, functionInfo.PackagePath, functionInfo.Call)

	} else if functionInfo.Kind == "pf" {
		content = fmt.Sprintf(`package shim

import (
	pf "github.com/hashicorp/terraform-plugin-framework/provider"
	upstream "%s/%s"
)

func PFProvider() pf.Provider {
	return upstream.%s
}
`, upstreamModule, functionInfo.PackagePath, functionInfo.Call)
	} else {
		return "", "", fmt.Errorf("unknown function kind: %s", functionInfo.Kind)
	}

	filename := fmt.Sprintf("%s.go", functionInfo.Kind)
	return filename, content, nil
}

func generateLocalShim(ctx context.Context, config bridgedProviderConfig, fns []FunctionInfo) (string, error) {
	logger := logging.GetLogger(ctx)
	var hasSdk string
	var sdkShimImport string
	var sdkShimConstructor string
	var hasPf bool
	for _, v := range fns {
		if v.Kind == "sdk-v1" {
			hasSdk = "sdk-v1"
			sdkShimImport = `shimv1 "github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfshim/sdk-v1"`
			sdkShimConstructor = "shimv1.NewProvider"
		} else if v.Kind == "sdk-v2" {
			hasSdk = "sdk-v2"
			sdkShimImport = `shimv2 "github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfshim/sdk-v2"`
			sdkShimConstructor = "shimv2.NewProvider"
		}
		if v.Kind == "pf" {
			hasPf = true
		}
	}
	logger.DebugContext(ctx, "Generating local shim", "sdk", hasSdk, "pf", hasPf)

	var content string

	var upstreamImport = fmt.Sprintf("%s/pulumi-shim", config.Mod)
	if hasSdk != "" && hasPf {
		content = `package provider

import (
	"context"

	pftfbridge "github.com/pulumi/pulumi-terraform-bridge/pf/tfbridge"
	shim "github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfshim"
	%[3]s
	upstream %[1]q
)

func ShimmedProvider() shim.Provider {
	return pftfbridge.MuxShimWithPF(
		context.Background(),
		%[4]s(upstream.SDKProvider()),
		upstream.PFProvider(),
	)
}

func TfbridgeMain(pulumiSchema []byte, bridgeMetadata []byte) {
	meta := pftfbridge.ProviderMetadata{
		PackageSchema:  pulumiSchema,
		BridgeMetadata: bridgeMetadata,
	}
	pftfbridge.Main(context.Background(), %[2]q, Provider(), meta)
}
`
		content = fmt.Sprintf(content, upstreamImport, config.Provider, sdkShimImport, sdkShimConstructor)

	} else if hasPf {
		content = `package provider

import (
	"context"

	pftfbridge "github.com/pulumi/pulumi-terraform-bridge/pf/tfbridge"
	shim "github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfshim"
	upstream %[1]q
)

func ShimmedProvider() shim.Provider {
	return pftfbridge.ShimProvider(upstream.PFProvider())
}

func TfbridgeMain(pulumiSchema []byte, bridgeMetadata []byte) {
	meta := pftfbridge.ProviderMetadata{
		PackageSchema:  pulumiSchema,
		BridgeMetadata: bridgeMetadata,
	}
	pftfbridge.Main(context.Background(), %[2]q, Provider(), meta)
}
`
		content = fmt.Sprintf(content, upstreamImport, config.Provider)
	} else if hasSdk != "" {
		content = `package provider

import (
	"github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfbridge"
	shim "github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfshim"
	%[3]s
	upstream %[1]q
)

func ShimmedProvider() shim.Provider {
	return %[4]s(upstream.SDKProvider())
}

func TfbridgeMain(pulumiSchema []byte, _ []byte) {
	tfbridge.Main(%[2]q, pkgVersion, Provider(), pulumiSchema)
}
`
		content = fmt.Sprintf(content, upstreamImport, config.Provider, sdkShimImport, sdkShimConstructor)
	}

	if content == "" {
		return "", fmt.Errorf("no functions found")
	}

	return content, nil
}
