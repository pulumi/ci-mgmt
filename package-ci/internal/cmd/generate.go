package cmd

import (
	"github.com/pulumi/ci-mgmt/package-ci/internal/pkg"
	"github.com/spf13/cobra"
)

var generateOpts = &pkg.GenerateOpts{}

// generateCmd represents the generate command
var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate repository files.",
	RunE: func(cmd *cobra.Command, args []string) error {
		err := pkg.GeneratePackage(pkg.GenerateOpts{
			RepositoryName: generateOpts.RepositoryName,
			OutDir:         generateOpts.OutDir,
			TemplateName:   generateOpts.TemplateName,
			ConfigPath:     generateOpts.ConfigPath,
		})
		return err
	},
}

func init() {
	rootCmd.AddCommand(generateCmd)

	generateCmd.Flags().StringVarP(&generateOpts.RepositoryName, "name", "n", "", "repository name to generate, e.g.: pulumi/pulumi-aws")
	generateCmd.MarkFlagRequired("name")

	generateCmd.Flags().StringVarP(&generateOpts.OutDir, "out", "o", ".", "directory to generate files to")
	generateCmd.MarkFlagRequired("out")

	/*
		type GenerateOpts struct {
			PackageName  string // e.g.: pulumi-aws
			OutDir       string
			TemplateName string // path inside templates, e.g.: bridged-provider
			ConfigPath   string // .yaml file containing template config
		}
	*/

	generateCmd.Flags().StringVarP(&generateOpts.TemplateName, "template", "t", "", "template name to use, e.g.: bridged-provider")
	generateCmd.MarkFlagRequired("template")
	generateCmd.Flags().StringVarP(&generateOpts.ConfigPath, "config", "c", "", "config file to use, e.g.: config.yaml")
	generateCmd.MarkFlagRequired("config")
}
