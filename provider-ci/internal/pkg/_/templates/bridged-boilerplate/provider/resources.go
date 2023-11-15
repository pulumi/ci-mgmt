// Copyright 2016-2018, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package provider

import (
	_ "embed" // Embed bridge metadata
	"fmt"
	"path"

	"github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfbridge"
	"github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfbridge/x"
	shim "github.com/pulumi/pulumi-terraform-bridge/v3/pkg/tfshim"
	"github.com/pulumi/pulumi/sdk/v3/go/common/resource"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/contract"

	"#{{ .Module }}#/provider/pkg/version"
)

//go:embed cmd/pulumi-resource-#{{ .Name }}#/bridge-metadata.json
var metadata []byte

const providerName = "#{{ .Name }}#"

var pkgVersion = version.Version

// TODO: preConfigureCallback validates configuration to provide actionable errors. This is
// generally needed when the upstream provider does not provide high quality error messages.
func preConfigureCallback(vars resource.PropertyMap, c shim.ResourceConfig) error {
	// stringValue := func(vars resource.PropertyMap, prop resource.PropertyKey, envs []string) (string, error) {
	// 	val, ok := vars[prop]
	// 	if ok && val.IsString() {
	// 		return val.StringValue(), nil
	// 	}
	// 	for _, env := range envs {
	// 		val, ok := os.LookupEnv(env)
	// 		if ok {
	// 			return val, nil
	// 		}
	// 	}
	// 	return "", fmt.Errorf("provider configuration %s:%s and env vars %v not defined", providerName, prop, envs)
	// }

	// _, err := stringValue(vars, "token", []string{"#{{ upper .Name }}#_TOKEN"})

	// if err != nil {
	// 	return fmt.Errorf("failed to configure API token: %w", err)
	// }

	return nil
}

// Provider returns additional overlaid schema and metadata associated with the provider..
func Provider() tfbridge.ProviderInfo {
	prov := tfbridge.ProviderInfo{
		P:                ShimmedProvider(),
		Name:             providerName,
		MetadataInfo:     tfbridge.NewProviderMetadata(metadata),
		Version:          pkgVersion,
		UpstreamRepoPath: "./upstream",
		// DisplayName is a way to be able to change the casing of the provider
		// name when being displayed on the Pulumi registry
		DisplayName: "#{{ .Config.providerTitle }}#",
		// The default publisher for all packages is Pulumi.
		// Change this to your personal name (or a company name) that you
		// would like to be shown in the Pulumi Registry if this package is published
		// there.
		Publisher: "Pulumi",
		// LogoURL is optional but useful to help identify your package in the Pulumi Registry
		// if this package is published there.
		//
		// You may host a logo on a domain you control or add an SVG logo for your package
		// in your repository and use the raw content URL for that file as your logo URL.
		LogoURL: "",
		// PluginDownloadURL is an optional URL used to download the Provider
		// for use in Pulumi programs
		// e.g https://github.com/org/pulumi-provider-name/releases/
#{{- if eq (printf "github.com/pulumi/pulumi-%s" .Name) .Module }}#
		PluginDownloadURL: "",
#{{- else if hasPrefix "github.com/" .Module }}#
		PluginDownloadURL: "github://api.github.com/#{{ .Repository }}#",
#{{- end }}#
		Description:       "A Pulumi package for creating and managing #{{ .Config.providerTitle }}# cloud resources.",
		// category/cloud tag helps with categorizing the package in the Pulumi Registry.
		// For all available categories, see `Keywords` in
		// https://www.pulumi.com/docs/guides/pulumi-packages/schema/#package.
		Keywords:   []string{"pulumi", "category/cloud"},
		License:    "Apache-2.0",
		Homepage:   "#{{ .Config.homepage }}#",
		Repository: "https://#{{ .Module }}#",
		// The GitHub Org hosting the upstream provider - defaults to `terraform-providers`. Note that
		// this should match the TF provider module's require directive, not any replace directives.
		GitHubOrg: "#{{ .Config.upstreamOrg }}#",
		Config:    map[string]*tfbridge.SchemaInfo{
			// Add any required configuration here, this provides structured docs for configuration.
			// "mode": {
			//  Default: &tfbridge.DefaultInfo{
			//    EnvVars: []string{"#{{ upper .Name }}#_MODE"}, // Multiple vars can be used
			//    Value:   "local",
			//  },
			// },
		},
		PreConfigureCallback: preConfigureCallback,
		JavaScript: &tfbridge.JavaScriptInfo{
			Dependencies: map[string]string{
				"@pulumi/pulumi": "^3.0.0",
			},
			DevDependencies: map[string]string{
				"@types/node": "^16.0.0", // so we can access strongly typed node definitions.
			},
		},
		Python: &tfbridge.PythonInfo{
			Requires: map[string]string{
				"pulumi": ">=3.0.0,<4.0.0",
			},
		},
		Golang: &tfbridge.GolangInfo{
			ImportBasePath: path.Join(
				"#{{ .Module }}#/sdk",
				tfbridge.GetModuleMajorVersion(pkgVersion),
				"go",
				providerName,
			),
			GenerateResourceContainerTypes: true,
		},
		CSharp: &tfbridge.CSharpInfo{
			PackageReferences: map[string]string{
				"Pulumi": "3.*",
			},
		},
	}

	err := x.ComputeDefaults(
		&prov,
		x.TokensSingleModule(
			fmt.Sprintf("%s_", providerName),
			"index",
			x.MakeStandardToken(providerName),
		),
	)
	contract.AssertNoErrorf(err, "Failed to compute defaults")

	err = x.AutoAliasing(&prov, prov.GetMetadata())
	contract.AssertNoErrorf(err, "Failed to apply aliasing")

	prov.SetAutonaming(255, "-")

	return prov
}
