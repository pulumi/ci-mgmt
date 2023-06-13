package cmd

import (
	"context"
	"os"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/logging"
	"github.com/spf13/cobra"
)

var verbose int

var rootCmd = &cobra.Command{
	Use:   "provider-ci",
	Short: "Configure CI/CD for Pulumi packages",
	Long:  `Configures GitHub Actions workflows and Makefile targets for a Pulumi package.`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		logger := logging.NewDefaultLogger()
		logging.SetVerbosity(logger, verbose)
		ctx := logging.ContextWithLogger(cmd.Context(), logger)
		cmd.SetContext(ctx)

		return nil
	},
}

func Execute() {
	rootCmd.PersistentFlags().IntVarP(&verbose, "verbose", "v", 1,
		"Enable verbose logging (e.g., v=3); anything >3 is very verbose, default is 1")

	err := rootCmd.ExecuteContext(context.Background())
	if err != nil {
		os.Exit(1)
	}
}
