package cmd

import (
	"fmt"
	"os"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/logging"
	"github.com/spf13/cobra"
)

func init() {
	var generateOpts = pkg.GenerateOpts{}
	var configFilePath string

	// generateCmd represents the generate command
	var generateCmd = &cobra.Command{
		Use:   "generate",
		Short: "Generate repository files.",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			configBytes, err := os.ReadFile(configFilePath)
			if err != nil {
				return fmt.Errorf("error reading config file %s: %w", configFilePath, err)
			}

			generateOpts.Config = configBytes

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()
			ctx = logging.ContextLogWith(ctx, "command", "generate", "name", generateOpts.Name)

			logging.GetLogger(ctx).InfoContext(ctx, "Generating package")
			err := pkg.GeneratePackage(cmd.Context(), generateOpts)
			if err != nil {
				logging.GetLogger(ctx).ErrorContext(ctx, "Failed to generate package", "error", err)
				return err
			}
			logging.GetLogger(ctx).InfoContext(ctx, "Generated package")
			return nil
		},
	}

	generateCmd.Flags().StringVarP(&generateOpts.Name, "name", "n", "", "repository name to generate, e.g.: pulumi/pulumi-aws")
	_ = generateCmd.MarkFlagRequired("name")

	generateCmd.Flags().StringVarP(&generateOpts.OutDir, "out", "o", ".", "directory to generate files to")
	_ = generateCmd.MarkFlagRequired("out")

	generateCmd.Flags().StringVarP(&generateOpts.TemplateName, "template", "t", "", "template name to use, e.g.: bridged-provider")
	_ = generateCmd.MarkFlagRequired("template")

	generateCmd.Flags().StringVarP(&configFilePath, "config", "c", "", "config file to use, e.g.: config.yaml")
	_ = generateCmd.MarkFlagRequired("config")

	generateCmd.Flags().BoolVarP(&generateOpts.ExecuteScripts, "execute-scripts", "x", true, "whether to execute scripts, defaults to true")

	rootCmd.AddCommand(generateCmd)
}
