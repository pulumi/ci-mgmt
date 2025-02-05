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
	internal TemplateDir = "internal"
	// ci-mgmt pull-based updates workflow
	external TemplateDir = "external"
	// Makefile for bridged providers (internal & external)
	bridged TemplateDir = "bridged"
	// Upgrade config
	internalBridged TemplateDir = "internal-bridged"
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
		return []TemplateDir{base, internal, bridged, internalBridged}, nil
	case "external-bridged-provider":
		// third-party bridged providers
		return []TemplateDir{base, external, bridged}, nil
	case "generic":
		// Pulumi-owned providers not based on tf-bridge
		return []TemplateDir{base, internal}, nil
	default:
		return nil, fmt.Errorf("unknown template: %s", templateName)
	}
}
