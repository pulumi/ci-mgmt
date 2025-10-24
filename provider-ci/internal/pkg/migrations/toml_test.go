package migrations

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTomlEnsureSectionEntriesAddsMissing(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "mise.toml")
	initial := `[tools]
"github:pulumi/pulumictl" = "latest"

[settings]
foo = "bar"
`
	if err := os.WriteFile(path, []byte(initial), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	tf, err := newTomlFile(path)
	if err != nil {
		t.Fatalf("newTomlFile: %v", err)
	}
	entries := []sectionEntry{{
		key:   "github:pulumi/pulumi-random",
		value: "latest",
	}}
	updated, err := tf.ensureSectionEntries("tools", entries)
	if err != nil {
		t.Fatalf("ensureSectionEntries: %v", err)
	}
	if !updated {
		t.Fatalf("expected ensureSectionEntries to report updates")
	}
	if err := tf.writeFile(); err != nil {
		t.Fatalf("writeFile: %v", err)
	}
	out, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read result: %v", err)
	}
	content := string(out)
	addLine := "\"github:pulumi/pulumi-random\" = \"latest\""
	if !strings.Contains(content, addLine) {
		t.Fatalf("expected inserted line %q in output:\n%s", addLine, content)
	}
	if idxNew, idxSettings := strings.Index(content, addLine), strings.Index(content, "[settings]"); idxNew == -1 || idxSettings == -1 || idxNew > idxSettings {
		t.Fatalf("expected new tool entry before [settings], got:\n%s", content)
	}
}

func TestTomlEnsureSectionEntriesSkipsExisting(t *testing.T) {
	tf := &tomlFile{
		content: []byte(`[tools]
"github:pulumi/pulumictl" = "latest"
`),
	}
	entries := []sectionEntry{{
		key:   "github:pulumi/pulumictl",
		value: "latest",
	}}
	updated, err := tf.ensureSectionEntries("tools", entries)
	if err != nil {
		t.Fatalf("ensureSectionEntries: %v", err)
	}
	if updated {
		t.Fatalf("expected no updates when entry already present")
	}
}

func TestTomlEnsureSectionEntriesCreatesSection(t *testing.T) {
	tf := &tomlFile{
		content: []byte(`[tools]
"github:pulumi/pulumictl" = "latest"
`),
	}
	entries := []sectionEntry{{
		key:   "pulumi-mise",
		value: "https://github.com/pulumi/mise-backend-pulumi",
	}}
	updated, err := tf.ensureSectionEntries("plugins", entries)
	if err != nil {
		t.Fatalf("ensureSectionEntries: %v", err)
	}
	if !updated {
		t.Fatalf("expected ensureSectionEntries to create missing section")
	}
	out := string(tf.content)
	expected := `[plugins]
pulumi-mise = "https://github.com/pulumi/mise-backend-pulumi"`
	if !strings.Contains(out, expected) {
		t.Fatalf("expected output to contain %q, got:\n%s", expected, out)
	}
}

func TestTomlEnsureSectionEntriesDoesNotOverwriteExisting(t *testing.T) {
	tf := &tomlFile{
		content: []byte(`[plugins]
pulumi-mise = "https://example.com"
`),
	}
	entries := []sectionEntry{{
		key:   "pulumi-mise",
		value: "https://github.com/pulumi/mise-backend-pulumi",
	}}
	updated, err := tf.ensureSectionEntries("plugins", entries)
	if err != nil {
		t.Fatalf("ensureSectionEntries: %v", err)
	}
	if updated {
		t.Fatalf("expected ensureSectionEntries to avoid modifying existing keys")
	}
	if strings.Contains(string(tf.content), "https://github.com/pulumi/mise-backend-pulumi") {
		t.Fatalf("expected ensureSectionEntries not to update existing values:\n%s", tf.content)
	}
}

func TestNewTomlFileMissingCreatesPlaceholder(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "mise.toml")
	tf, err := newTomlFile(path)
	if err != nil {
		t.Fatalf("newTomlFile: %v", err)
	}
	if tf == nil {
		t.Fatalf("expected tomlFile instance")
	}
	if _, err := os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("expected file %s to not exist yet", path)
	}
	tf.content = []byte("[tools]\n")
	if err := tf.writeFile(); err != nil {
		t.Fatalf("writeFile: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file %s to be created by writeFile: %v", path, err)
	}
}

func TestParseTomlKey(t *testing.T) {
	cases := []struct {
		line     string
		key      string
		expected bool
	}{
		{`"github:pulumi/pulumictl" = "latest"`, "github:pulumi/pulumictl", true},
		{"# comment", "", false},
		{"", "", false},
		{"foo = \"bar\"", "foo", true},
	}

	for _, tc := range cases {
		key, ok := parseTomlKey(tc.line)
		if ok != tc.expected || key != tc.key {
			t.Fatalf("parseTomlKey(%q) => (%q,%v), expected (%q,%v)", tc.line, key, ok, tc.key, tc.expected)
		}
	}
}
