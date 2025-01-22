package pkg

import (
	"fmt"
)

// Template directories
const (
	// configuration to run the repository in a dev container
	devContainer = "dev-container"
	// git attributes, go config, CI reusable workflows
	provider = "provider"
	// CoC, upgrade-provider config, issue templates, command dispatch workflows
	pulumiProvider = "pulumi-provider"
	// ci-mgmt pull-based updates workflow
	externalProvider = "external-provider"
	// Generic provider CI templates
	providerCi = "provider-ci"
	// Makefile for bridged providers (internal & external)
	bridgedProvider = "bridged-provider"
	// Makefile for typescript providers
	typescriptProvider = "typescript-provider"
)

// getTemplateDirs returns a list of directories in the embedded filesystem that form the overall template.
// Templates are composed of one or more template folders within this directory.
// Each directory is rendered into the same output directory.
// Care should be taken to ensure that the template files do not conflict with each other.
func getTemplateDirs(opts GenerateOpts) ([]string, error) {
	// Note: Render more specific templates last to allow them to override more general templates.
	// The `.ci-mgmt.yaml` `template` property can be set to one of 3 values:
	switch opts.TemplateName {
	case "bridged-provider":
		// Any Pulumi-owned bridged provider
		return []string{devContainer, provider, pulumiProvider, providerCi, bridgedProvider}, nil
	case "external-bridged-provider":
		// third-party bridged providers
		return []string{devContainer, provider, externalProvider, providerCi, bridgedProvider}, nil
	case "pulumi-custom-provider":
		// Any Pulumi-owned provider that isn't bridged
		return []string{devContainer, provider, pulumiProvider, providerCi}, nil
	case "pulumi-typescript-provider":
		// Any Pulumi-owned provider that's written in TypeScript
		return []string{devContainer, provider, pulumiProvider, typescriptProvider}, nil
	case "generic":
		// currently almost identical to the bridged-provider template
		return []string{provider, pulumiProvider, providerCi, bridgedProvider}, nil
	default:
		return nil, fmt.Errorf("unknown template: %s", opts.TemplateName)
	}
}
