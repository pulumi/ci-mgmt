package migrations

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// cimgmtYaml wraps the contents of a .ci-mgmt.yaml file along with its source path.
type cimgmtYaml struct {
	path string
	// we operate on the yaml.Node so that we can preserve comments and ordering
	node *yaml.Node
}

// newCimgmtYaml loads the YAML document from disk and prepares it for mutation.
func newCimgmtYaml(path string) (*cimgmtYaml, error) {
	ciMgmtPath := path
	ciMgmtFile, err := os.ReadFile(ciMgmtPath)
	if err != nil {
		return nil, fmt.Errorf("error reading .ci-mgmt.yaml: %w", err)
	}

	var ciMgmt yaml.Node
	if err := yaml.Unmarshal(ciMgmtFile, &ciMgmt); err != nil {
		return nil, fmt.Errorf("error unmarshaling .ci-mgmt.yaml: %w", err)
	}

	return &cimgmtYaml{
		node: &ciMgmt,
		path: path,
	}, nil
}

// writeFile persists the in-memory YAML representation back to its original path.
func (c *cimgmtYaml) writeFile() error {
	newCiMgmt, err := yaml.Marshal(c.node)
	if err != nil {
		return fmt.Errorf("error marshaling .ci-mgmt.yaml: %w", err)
	}
	if err := os.WriteFile(c.path, newCiMgmt, 0644); err != nil {
		return fmt.Errorf("error writing .ci-mgmt.yaml: %w", err)
	}

	return nil
}

// deleteKey deletes a top level field from the ci-mgmt.yaml file
func (c *cimgmtYaml) deleteKey(key string) {
	node := c.node.Content[0]
	if node == nil || node.Kind != yaml.MappingNode {
		return
	}

	out := node.Content[:0]
	for i := 0; i < len(node.Content); i += 2 {
		if i+1 >= len(node.Content) {
			continue
		}
		k := node.Content[i]
		v := node.Content[i+1]
		if k.Value == key {
			continue // skip this key/value pair (delete)
		}
		out = append(out, k, v)
	}
	node.Content = out
}

// getFieldNode gets a top level field from the ci-mgmt.yaml file
func (c *cimgmtYaml) getFieldNode(key string) *yaml.Node {
	node := c.node.Content[0]
	if node.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i < len(node.Content); i += 2 {
		k := node.Content[i]
		v := node.Content[i+1]
		if k.Value == key {
			return v
		}
	}
	return nil
}

// nodeToMap converts a yaml.Node with object data to a map[string]string
func nodeToMap(m *yaml.Node) map[string]string {
	if m == nil {
		return nil
	}
	if m.Kind != yaml.MappingNode {
		return nil
	}
	out := make(map[string]string)
	for i := 0; i < len(m.Content); i += 2 {
		k := m.Content[i]
		v := m.Content[i+1]
		out[k.Value] = v.Value
	}
	return out
}
