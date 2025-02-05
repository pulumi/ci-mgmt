package pkg

import (
	"fmt"
)

// TemplateDir is a directory in the embedded filesystem that contains files to be rendered into the output directory.
// Multiple templates are combined together to form the overall template (see `getTemplateDirs`).
type TemplateDir string

// Template directories
const (
	// git attributes, go config, CI reusable workflows, dev container, generic CI
	base TemplateDir = "base"
	// CoC, upgrade-provider config, issue templates, command dispatch workflows
	pulumiProvider TemplateDir = "pulumi-provider"
	// ci-mgmt pull-based updates workflow
	externalProvider TemplateDir = "external-provider"
	// Makefile for bridged providers (internal & external)
	bridgedProvider TemplateDir = "bridged-provider"
)

// getTemplateDirs returns a list of directories in the embedded filesystem that form the overall template.
// Templates are composed of one or more template folders within this directory.
// Each directory is rendered into the same output directory.
// Care should be taken to ensure that the template files do not conflict with each other.
func getTemplateDirs(templateName string) ([]TemplateDir, error) {
	// Note: Render more specific templates last to allow them to override more general templates.
	// The `.ci-mgmt.yaml` `template` property can be set to one of 3 values:
	switch templateName {
	case "bridged-provider":
		// Any Pulumi-owned bridged provider
		return []TemplateDir{base, pulumiProvider, bridgedProvider}, nil
	case "external-bridged-provider":
		// third-party bridged providers
		return []TemplateDir{base, externalProvider, bridgedProvider}, nil
	case "generic":
		// currently almost identical to the bridged-provider template
		return []TemplateDir{base, pulumiProvider, bridgedProvider}, nil
	default:
		return nil, fmt.Errorf("unknown template: %s", templateName)
	}
}
