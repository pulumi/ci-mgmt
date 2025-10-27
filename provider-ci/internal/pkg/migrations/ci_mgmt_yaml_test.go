package migrations

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCimgmtYamlDeleteKeyAndWrite(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".ci-mgmt.yaml")
	initial := `toolVersions:
  pulumictl: "1.x"
plugins:
  - name: random
    version: latest
`
	if err := os.WriteFile(path, []byte(initial), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	cimgmt, err := newCimgmtYaml(path)
	if err != nil {
		t.Fatalf("newCimgmtYaml: %v", err)
	}

	if node := cimgmt.getFieldNode("missing"); node != nil {
		t.Fatalf("expected missing field to return nil")
	}

	toolVersions := cimgmt.getFieldNode("toolVersions")
	if toolVersions == nil {
		t.Fatalf("expected toolVersions node")
	}
	tvMap := nodeToMap(toolVersions)
	if got := tvMap["pulumictl"]; got != "1.x" {
		t.Fatalf("toolVersions map mismatch: got %q", got)
	}

	cimgmt.deleteKey("plugins")
	if err := cimgmt.writeFile(); err != nil {
		t.Fatalf("writeFile: %v", err)
	}

	out, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read result: %v", err)
	}
	content := string(out)
	if strings.Contains(content, "plugins") {
		t.Fatalf("expected plugins key removed, got:\n%s", content)
	}
	if !strings.Contains(content, "toolVersions") {
		t.Fatalf("expected toolVersions key retained, got:\n%s", content)
	}
}

func TestCimgmtYamlMissingFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".ci-mgmt.yaml")
	if _, err := newCimgmtYaml(path); err == nil {
		t.Fatalf("expected error when file missing")
	}
}
