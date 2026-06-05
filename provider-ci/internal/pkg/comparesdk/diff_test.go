package comparesdk

import (
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var update = flag.Bool("update", false, "update golden expected.txt files under testdata/")

// TestCompareScenarios runs every scenario directory under testdata/ through
// Compare and checks both rendered reports against goldens: expected.txt for
// RenderText (the job log) and expected.md for RenderMarkdown (the step
// summary). A scenario may omit its legacy/ or gensdk/ tree; a missing tree is
// treated as empty (a language absent from one generator).
//
// Regenerate goldens after intentional changes with:
//
//	go test ./internal/pkg/comparesdk/ -run TestCompareScenarios -update
func TestCompareScenarios(t *testing.T) {
	entries, err := os.ReadDir("testdata")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		t.Run(name, func(t *testing.T) {
			base := filepath.Join("testdata", name)
			report, err := Compare("example", "nodejs",
				filepath.Join(base, "legacy"), filepath.Join(base, "gensdk"),
				CompareOptions{ContextLines: 3, SampleHunks: 3})
			if err != nil {
				t.Fatal(err)
			}
			checkGolden(t, filepath.Join(base, "expected.txt"), report.RenderText())
			checkGolden(t, filepath.Join(base, "expected.md"), report.RenderMarkdown())
		})
	}
}

// checkGolden compares got against the file at path, or overwrites it when the
// -update flag is set.
func checkGolden(t *testing.T, path, got string) {
	t.Helper()
	if *update {
		if err := os.WriteFile(path, []byte(got), 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading golden (run with -update to create it): %v", err)
	}
	if got != string(want) {
		t.Errorf("mismatch for %s\n--- got ---\n%s\n--- want ---\n%s", path, got, want)
	}
}

// TestCompareMissingLanguageDirIsEmpty covers an edge case awkward to express
// as a committed fixture: a language absent from one generator entirely. A
// non-existent tree yields "added" entries rather than an error.
func TestCompareMissingLanguageDirIsEmpty(t *testing.T) {
	gen := t.TempDir()
	p := filepath.Join(gen, "a.ts")
	if err := os.WriteFile(p, []byte("x\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	report, err := Compare("aws", "nodejs", filepath.Join(gen, "does-not-exist"), gen, CompareOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if report.TotalFiles != 1 || len(report.Diffs) != 1 || report.Diffs[0].Status != StatusAdded {
		t.Errorf("unexpected report: %+v", report)
	}
}

// TestRenderTextIncludesSampleHunks exercises report rendering directly,
// independent of the diff backend.
func TestRenderTextIncludesSampleHunks(t *testing.T) {
	r := &Report{
		Provider: "aws", Language: "nodejs", TotalFiles: 2, IdenticalFiles: 1,
		Diffs: []FileDiff{{
			Path: "index.ts", Status: StatusChanged, HunkCount: 2,
			SampleHunks: []string{"@@ -1 +1 @@\n-a\n+b"},
		}},
	}
	text := r.RenderText()
	if !strings.Contains(text, "index.ts (2 hunks)") {
		t.Errorf("missing file header in:\n%s", text)
	}
	if !strings.Contains(text, "-a") || !strings.Contains(text, "+b") {
		t.Errorf("missing hunk body in:\n%s", text)
	}
	if !strings.Contains(text, "1 more hunk") {
		t.Errorf("missing truncation note in:\n%s", text)
	}
}
