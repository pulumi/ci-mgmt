package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"

	"github.com/bitfield/script"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/comparesdk"
	"github.com/spf13/cobra"
)

type compareSDKArguments struct {
	Language   string
	Dir        string
	ConfigPath string
	Template   string
	// CodegenBin is the path to the legacy per-provider codegen binary
	// (pulumi-tfgen-<provider> / pulumi-gen-<provider>).
	CodegenBin string
	SchemaPath string
	Version    string

	// Stopgap hooks. These let you apply a migration stopgap and re-run the
	// comparison to assert it closes the legacy<->gen-sdk gap: a clean exit
	// means the stopgap fully closed the gap, remaining hunks are the residual
	// delta it does not cover. All default to empty (no hook).
	//
	// SchemaCmd transforms the schema.json fed to gen-sdk before generation
	// (a "schema prefilter" stopgap). The schema's path is exported as $SCHEMA.
	SchemaCmd string
	// GenSDKCmd / LegacyCmd run against the generated gen-sdk / legacy SDK tree
	// after generation (e.g. an sdk-hooks.mk stopgap target). The tree's path
	// is exported as $SDK_DIR and is also the command's working directory.
	GenSDKCmd string
	LegacyCmd string

	// SampleHunks is the maximum number of diff hunks shown per changed file in
	// the report.
	SampleHunks int
	// ContextLines is the number of unchanged context lines shown around each
	// diff hunk.
	ContextLines int
	ReportFile   string
}

var compareSDKArgs compareSDKArguments

// knownLanguages are the SDK languages the comparison understands. These match
// the language names used by both the legacy codegen binary and
// `pulumi package gen-sdk`.
var knownLanguages = []string{"dotnet", "go", "java", "nodejs", "python"}

var compareSDKCmd = &cobra.Command{
	Use:   "compare-sdk",
	Short: "Compare legacy codegen SDK output against `pulumi package gen-sdk`.",
	Long: `Generates a provider's SDK for one language two ways - via the legacy
per-provider codegen binary and via the generic "pulumi package gen-sdk" - from
the same schema.json into isolated temporary directories, normalizes a
documented allowlist of cosmetic differences, and reports any remaining
difference. Exits non-zero if the two generators disagree.

This never touches the committed sdk/ directory. It expects the codegen binary
and schema.json to already exist (e.g. built by "make provider schema").

Run from a provider repo, comparing one language:

    provider-ci compare-sdk --language go

Assert a stopgap closes the gap (clean exit = stopgap fully closes it):

    provider-ci compare-sdk --language go --gensdk-cmd 'make _sdk_stopgap_go'`,
	SilenceUsage:  true,
	SilenceErrors: false,
	RunE: func(cmd *cobra.Command, args []string) error {
		if !slices.Contains(knownLanguages, compareSDKArgs.Language) {
			return fmt.Errorf("--language must be one of %s (got %q)", strings.Join(knownLanguages, ", "), compareSDKArgs.Language)
		}

		// --config is resolved relative to --dir unless it is absolute.
		configPath := compareSDKArgs.ConfigPath
		if !filepath.IsAbs(configPath) {
			configPath = filepath.Join(compareSDKArgs.Dir, configPath)
		}
		config, err := pkg.LoadLocalConfig(configPath)
		if err != nil {
			return err
		}

		template := compareSDKArgs.Template
		if template == "" {
			template = config.Template
		}
		genName := config.GenName
		if genName == "" {
			genName = pkg.DefaultGenName(template)
		}
		pack := config.Provider
		if pack == "" {
			return fmt.Errorf("provider name not set in %s", compareSDKArgs.ConfigPath)
		}

		// gen-sdk embeds the version into many SDK files (build.gradle, .csproj,
		// version.txt, pulumiUtilities.go, pulumi-plugin.json, ...). The legacy
		// codegen binary bakes its own version in via ldflags at build time, so
		// unless both sides use the same version those files differ on the version
		// string alone and swamp the real codegen differences (the allowlist only
		// neutralizes the version in pulumi-plugin.json). Default to
		// PROVIDER_VERSION, the value the legacy binary was built with (both the
		// Makefile and CI set it), so the version cancels out; fall back to a
		// synthetic dev version only when it is unset. An explicit --version wins.
		version := compareSDKArgs.Version
		if version == "" {
			version = os.Getenv("PROVIDER_VERSION")
		}
		if version == "" {
			version = fmt.Sprintf("%d.0.0-alpha.0+dev", config.MajorVersion)
		}

		// Default the codegen binary and schema paths the way the base Makefile
		// does. A relative default is resolved against --dir; an explicitly
		// provided path is used as-is (so it may be relative to the current
		// directory or absolute).
		codegenBin := compareSDKArgs.CodegenBin
		if codegenBin == "" {
			codegenBin = filepath.Join(compareSDKArgs.Dir, "bin", fmt.Sprintf("pulumi-%s-%s", genName, pack))
		}
		schemaPath := compareSDKArgs.SchemaPath
		if schemaPath == "" {
			schemaPath = filepath.Join(compareSDKArgs.Dir, "provider", "cmd", fmt.Sprintf("pulumi-resource-%s", pack), "schema.json")
		}

		if _, err := os.Stat(codegenBin); err != nil {
			return fmt.Errorf("codegen binary %s not found - run `make provider` first: %w", codegenBin, err)
		}
		if _, err := os.Stat(schemaPath); err != nil {
			return fmt.Errorf("schema %s not found - run `make schema` first: %w", schemaPath, err)
		}

		report, err := runComparison(comparisonInputs{
			provider:   pack,
			language:   compareSDKArgs.Language,
			dir:        compareSDKArgs.Dir,
			codegenBin: codegenBin,
			schemaPath: schemaPath,
			version:    version,
			schemaCmd:  compareSDKArgs.SchemaCmd,
			genSDKCmd:  compareSDKArgs.GenSDKCmd,
			legacyCmd:  compareSDKArgs.LegacyCmd,
			opts: comparesdk.CompareOptions{
				SampleHunks:  compareSDKArgs.SampleHunks,
				ContextLines: compareSDKArgs.ContextLines,
			},
		})
		if err != nil {
			return err
		}

		// Always emit the human-readable report to the job log.
		fmt.Print(report.RenderText())

		// Emit markdown to the GitHub step summary when running in Actions.
		if summary := os.Getenv("GITHUB_STEP_SUMMARY"); summary != "" {
			if _, err := script.Echo(report.RenderMarkdown()).AppendFile(summary); err != nil {
				fmt.Fprintf(os.Stderr, "warning: could not write GITHUB_STEP_SUMMARY: %v\n", err)
			}
		}

		// Write the uploadable artifact report when requested.
		if compareSDKArgs.ReportFile != "" {
			if _, err := script.Echo(report.RenderMarkdown()).WriteFile(compareSDKArgs.ReportFile); err != nil {
				return fmt.Errorf("writing report file %s: %w", compareSDKArgs.ReportFile, err)
			}
		}

		if report.HasDiffs() {
			return fmt.Errorf("%s %s SDK differs between legacy codegen and gen-sdk (%d file(s)); see report above",
				pack, compareSDKArgs.Language, len(report.Diffs))
		}
		return nil
	},
}

type comparisonInputs struct {
	provider   string
	language   string
	dir        string
	codegenBin string
	schemaPath string
	version    string
	schemaCmd  string
	genSDKCmd  string
	legacyCmd  string
	opts       comparesdk.CompareOptions
}

// runComparison generates the SDK both ways into isolated temp dirs, applies
// any stopgap hooks, and compares the two trees.
func runComparison(in comparisonInputs) (*comparesdk.Report, error) {
	legacyOut, err := os.MkdirTemp("", "shadow-gen-legacy-")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(legacyOut) }()
	genOut, err := os.MkdirTemp("", "shadow-gen-gensdk-")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(genOut) }()

	// Point the generators at the provider repo's own Pulumi home so they reuse
	// its plugin/examples cache instead of the developer's real ~/.pulumi, and
	// so parallel runs don't contend over global state (mirrors the Makefile's
	// GEN_ENVS). The stopgap hooks intentionally run without it.
	genEnv := []string{"PULUMI_HOME=" + filepath.Join(in.dir, ".pulumi")}

	// Legacy: the codegen binary writes the language SDK directly into --out,
	// e.g. `bin/pulumi-tfgen-aws go --out <tmp>/go/`.
	legacyLangDir := filepath.Join(legacyOut, in.language)
	if err := run(in.dir, genEnv, in.codegenBin, in.language, "--out", legacyLangDir+string(os.PathSeparator)); err != nil {
		return nil, fmt.Errorf("legacy codegen failed: %w", err)
	}
	if in.legacyCmd != "" {
		if err := run(legacyLangDir, []string{"SDK_DIR=" + legacyLangDir}, "sh", "-c", in.legacyCmd); err != nil {
			return nil, fmt.Errorf("legacy stopgap hook failed: %w", err)
		}
	}

	// Optional schema-prefilter stopgap: transform a copy of the schema before
	// feeding it to gen-sdk. The original committed schema is never modified.
	absSchema, err := filepath.Abs(in.schemaPath)
	if err != nil {
		return nil, err
	}
	if in.schemaCmd != "" {
		schemaTmp, err := os.MkdirTemp("", "shadow-gen-schema-")
		if err != nil {
			return nil, err
		}
		defer func() { _ = os.RemoveAll(schemaTmp) }()
		filtered := filepath.Join(schemaTmp, "schema.json")
		if _, err := script.File(absSchema).WriteFile(filtered); err != nil {
			return nil, fmt.Errorf("copying schema for prefilter: %w", err)
		}
		if err := run(in.dir, []string{"SCHEMA=" + filtered}, "sh", "-c", in.schemaCmd); err != nil {
			return nil, fmt.Errorf("schema stopgap hook failed: %w", err)
		}
		absSchema = filtered
	}

	// gen-sdk: creates a <language> subdirectory under --out, e.g.
	// `pulumi package gen-sdk schema.json --language go --version V --out <tmp>/`.
	if err := run(in.dir, genEnv, "pulumi", "package", "gen-sdk", absSchema,
		"--version", in.version, "--language", in.language, "--out", genOut); err != nil {
		return nil, fmt.Errorf("pulumi package gen-sdk failed: %w", err)
	}
	genLangDir := filepath.Join(genOut, in.language)
	if in.genSDKCmd != "" {
		if err := run(genLangDir, []string{"SDK_DIR=" + genLangDir}, "sh", "-c", in.genSDKCmd); err != nil {
			return nil, fmt.Errorf("gen-sdk stopgap hook failed: %w", err)
		}
	}

	return comparesdk.Compare(in.provider, in.language, legacyLangDir, genLangDir, in.opts)
}

// run executes name with args in workdir, appending extraEnv to the current
// environment and streaming output to stderr so progress is visible. It is used
// both for the generators (binary + args) and the stopgap hooks (`sh -c <cmd>`).
func run(workdir string, extraEnv []string, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = workdir
	cmd.Stdout = os.Stderr
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), extraEnv...)
	return cmd.Run()
}

func init() {
	rootCmd.AddCommand(compareSDKCmd)

	f := compareSDKCmd.Flags()
	f.StringVarP(&compareSDKArgs.Language, "language", "l", "", "SDK language to compare: dotnet, go, java, nodejs, or python (required)")
	f.StringVar(&compareSDKArgs.Dir, "dir", ".", "provider repository directory to run the generators in (defaults to the current directory)")
	f.StringVarP(&compareSDKArgs.ConfigPath, "config", "c", ".ci-mgmt.yaml", "config file path; resolved relative to --dir unless absolute")
	f.StringVarP(&compareSDKArgs.Template, "template", "t", "", "template name (default from config)")
	f.StringVar(&compareSDKArgs.CodegenBin, "codegen-bin", "", "path to the legacy codegen binary, relative to cwd or absolute (default bin/pulumi-<genName>-<provider> under --dir)")
	f.StringVar(&compareSDKArgs.SchemaPath, "schema", "", "path to schema.json, relative to cwd or absolute (default provider/cmd/pulumi-resource-<provider>/schema.json under --dir)")
	f.StringVar(&compareSDKArgs.Version, "version", "", "version passed to gen-sdk; cosmetic and normalized away (default <major>.0.0-alpha.0+dev)")
	f.StringVar(&compareSDKArgs.SchemaCmd, "schema-cmd", "", "stopgap: shell command to transform the schema before gen-sdk; the schema path is exported as $SCHEMA")
	f.StringVar(&compareSDKArgs.GenSDKCmd, "gensdk-cmd", "", "stopgap: shell command run on the gen-sdk output tree before diffing; the tree is the cwd and exported as $SDK_DIR")
	f.StringVar(&compareSDKArgs.LegacyCmd, "legacy-cmd", "", "stopgap: shell command run on the legacy output tree before diffing; the tree is the cwd and exported as $SDK_DIR")
	f.IntVar(&compareSDKArgs.SampleHunks, "sample-hunks", 3, "max number of sample diff hunks to show per changed file")
	f.IntVar(&compareSDKArgs.ContextLines, "context", 5, "number of context lines around each diff hunk")
	f.StringVar(&compareSDKArgs.ReportFile, "report-file", "", "write a markdown report to this path (for uploading as a CI artifact)")
	_ = compareSDKCmd.MarkFlagRequired("language")
}
