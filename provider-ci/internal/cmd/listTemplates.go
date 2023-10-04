package cmd

import (
	"fmt"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

// listTemplatesCmd represents the listTemplates command
var listTemplatesCmd = &cobra.Command{
	Use:   "list-templates",
	Short: "List available templates",
	RunE: func(cmd *cobra.Command, args []string) error {
		templates, err := pkg.ListTemplates()
		if err != nil {
			return err
		}
		out, err := yaml.Marshal(struct{ Templates []string }{Templates: templates})
		if err != nil {
			return err
		}
		fmt.Println(string(out))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(listTemplatesCmd)
}
