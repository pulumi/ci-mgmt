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
	// CI and Makefile for bridged providers (internal & external)
	bridgedProvider = "bridged-provider"
)

// getTemplateDirs returns a list of directories in the embedded filesystem that form the overall template.
// Templates are composed of one or more template folders within this directory.
// Each directory is rendered into the same output directory.
// Care should be taken to ensure that the template files do not conflict with each other.
func getTemplateDirs(templateName string) ([]string, error) {
	// Note: Render more specific templates last to allow them to override more general templates.
	// The `.ci-mgmt.yaml` `template` property can be set to one of 3 values:
	switch templateName {
	case "bridged-provider":
		// Any Pulumi-owned bridged provider
		return []string{devContainer, provider, pulumiProvider, bridgedProvider}, nil
	case "external-bridged-provider":
		// third-party bridged providers
		return []string{devContainer, provider, externalProvider, bridgedProvider}, nil
	case "generic":
		// currently almost identical to the bridged-provider template
		return []string{provider, pulumiProvider, bridgedProvider}, nil
	default:
		return nil, fmt.Errorf("unknown template: %s", templateName)
	}
}
