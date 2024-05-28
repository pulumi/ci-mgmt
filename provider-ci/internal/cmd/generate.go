package cmd

import (
	"fmt"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg"
	"github.com/spf13/cobra"
)

type generateArguments struct {
	RepositoryName string
	OutDir         string
	TemplateName   string
	ConfigPath     string
}

var generateArgs generateArguments

// generateCmd represents the generate command
var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate repository files.",
	RunE: func(cmd *cobra.Command, args []string) error {
		localConfig, err := pkg.LoadLocalConfig(generateArgs.ConfigPath)
		if err != nil {
			return err
		}
		// Template name priority: CLI flag > config file > "bridged-provider"
		if generateArgs.TemplateName == "" {
			if templateName, ok := localConfig["template"].(string); ok {
				generateArgs.TemplateName = templateName
			}
		}
		if generateArgs.TemplateName == "" {
			generateArgs.TemplateName = "bridged-provider"
		}

		// Name priority: CLI flag > config file ("repository", then "name" field)
		if generateArgs.RepositoryName == "" {
			if repositoryName, ok := localConfig["repository"].(string); ok {
				generateArgs.RepositoryName = repositoryName
			} else if name, ok := localConfig["name"].(string); ok {
				generateArgs.RepositoryName = name
			}
		}

		if generateArgs.RepositoryName == "" {
			return fmt.Errorf("repository name must be set either in the config file or via the --name flag")
		}

		// Merge local config with template defaults
		templateConfig, err := localConfig.WithTemplateDefaults(generateArgs.TemplateName)
		if err != nil {
			return err
		}
		err = pkg.GeneratePackage(pkg.GenerateOpts{
			RepositoryName: generateArgs.RepositoryName,
			OutDir:         generateArgs.OutDir,
			TemplateName:   generateArgs.TemplateName,
			Config:         templateConfig,
		})
		return err
	},
}

func init() {
	rootCmd.AddCommand(generateCmd)

	generateCmd.Flags().StringVarP(&generateArgs.RepositoryName, "name", "n", "", "repository name to generate (default \"{config.repository}\" or otherwise \"pulumi/pulumi-{config.provider}\")")
	generateCmd.Flags().StringVarP(&generateArgs.OutDir, "out", "o", ".", "directory to write generate files to")
	generateCmd.Flags().StringVarP(&generateArgs.TemplateName, "template", "t", "", "template name to generate (default \"{config.template}\" or otherwise \"bridged-provider\")")
	generateCmd.Flags().StringVarP(&generateArgs.ConfigPath, "config", "c", ".ci-mgmt.yaml", "local config file to use")
}
