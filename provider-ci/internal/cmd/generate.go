package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg"
	"github.com/spf13/cobra"
)

type generateArguments struct {
	RepositoryName string
	OutDir         string
	TemplateName   string
	ConfigPath     string
	SkipMigrations bool
}

var generateArgs generateArguments

// generateCmd represents the generate command
var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate repository files.",
	RunE: func(cmd *cobra.Command, args []string) error {
		config, err := pkg.LoadLocalConfig(generateArgs.ConfigPath)
		if err != nil {
			return err
		}

		// Template name priority: CLI flag > config file
		if generateArgs.TemplateName == "" {
			if config.Template != "" {
				generateArgs.TemplateName = config.Template
			}
		}

		// Name priority: CLI flag > config file ("repository", then "name" field)
		if generateArgs.RepositoryName == "" {
			if config.Repository != "" {
				generateArgs.RepositoryName = config.Repository
			} else {
				providerName := config.Provider
				organizationName := config.Organization
				if providerName != "" && organizationName != "" {
					generateArgs.RepositoryName = fmt.Sprintf("%s/pulumi-%s", organizationName, providerName)
				}
			}
		}

		if generateArgs.RepositoryName == "" {
			return fmt.Errorf("repository name must be set either in the config file or via the --name flag")
		}

		// Validate that the repository is owned by "pulumi"
		parts := strings.Split(generateArgs.RepositoryName, "/")
		if len(parts) != 2 {
			return fmt.Errorf("repository name must be in the format 'owner/repo', got: %s", generateArgs.RepositoryName)
		}
		if parts[0] != "pulumi" {
			fmt.Fprintln(os.Stderr, "Skipping workflow regeneration because this appears to be a third-party provider.")
			return nil
		}

		err = pkg.GeneratePackage(pkg.GenerateOpts{
			RepositoryName: generateArgs.RepositoryName,
			OutDir:         generateArgs.OutDir,
			TemplateName:   generateArgs.TemplateName,
			Config:         config,
			SkipMigrations: generateArgs.SkipMigrations,
		})
		return err
	},
}

func init() {
	rootCmd.AddCommand(generateCmd)

	generateCmd.Flags().StringVarP(&generateArgs.RepositoryName, "name", "n", "", "repository name to generate (default \"{config.repository}\" or otherwise \"{config.organization}/pulumi-{config.provider}\")")
	generateCmd.Flags().StringVarP(&generateArgs.OutDir, "out", "o", ".", "directory to write generate files to")
	generateCmd.Flags().StringVarP(&generateArgs.TemplateName, "template", "t", "", "template name to generate (default \"{config.template}\" or otherwise \"bridged-provider\")")
	generateCmd.Flags().StringVarP(&generateArgs.ConfigPath, "config", "c", ".ci-mgmt.yaml", "local config file to use")
	generateCmd.Flags().BoolVar(&generateArgs.SkipMigrations, "skip-migrations", false, "skip running migrations")
}
