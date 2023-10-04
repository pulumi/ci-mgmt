package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "provider-ci",
	Short: "Configure CI/CD for Pulumi packages",
	Long:  `Configures GitHub Actions workflows and Makefile targets for a Pulumi package.`,
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}
