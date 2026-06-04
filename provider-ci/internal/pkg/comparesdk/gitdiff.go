package comparesdk

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// hunkHeader matches a unified-diff hunk header and captures just the
// "@@ -a,b +c,d @@" portion, dropping any trailing function-context hint git
// appends (which varies by language/heuristic and would make output unstable).
var hunkHeader = regexp.MustCompile(`^(@@ -\S+ \+\S+ @@)`)

// gitHunks renders the unified-diff hunks between two already-normalized file
// contents using `git diff --no-index`.
//
// We shell out to git rather than reimplement a line diff: git's hunking is
// battle-tested and matches what a reviewer sees locally. By the time we get
// here the cosmetic-diff allowlist (see normalize.go) has already removed
// whitespace and other intentionally-ignored differences, so git only ever
// sees real differences and we deliberately do not use any of git's own
// ignore-whitespace flags (which would be blunter than our targeted rules and
// could hide meaningful structural changes between the two generators).
func gitHunks(a, b []byte, contextLines int) ([]string, error) {
	tmp, err := os.MkdirTemp("", "shadow-gen-hunk-")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(tmp) }()
	pa := filepath.Join(tmp, "legacy")
	pb := filepath.Join(tmp, "gen-sdk")
	if err := os.WriteFile(pa, a, 0o644); err != nil {
		return nil, err
	}
	if err := os.WriteFile(pb, b, 0o644); err != nil {
		return nil, err
	}

	cmd := exec.Command("git", "diff", "--no-index", "--no-color",
		fmt.Sprintf("--unified=%d", contextLines), "--", pa, pb)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	// git diff exits 0 when the files are identical and 1 when they differ; any
	// other exit code is a real error.
	if err := cmd.Run(); err != nil {
		var ee *exec.ExitError
		if !errors.As(err, &ee) || ee.ExitCode() != 1 {
			return nil, fmt.Errorf("git diff failed: %w: %s", err, out.String())
		}
	}
	return parseHunks(out.String()), nil
}

// parseHunks splits unified-diff text into individual hunks, each rendered as
// its normalized "@@ ... @@" header followed by its body lines. Everything
// before the first hunk header (the diff/index/--- /+++ preamble) is dropped.
func parseHunks(diff string) []string {
	var hunks []string
	var cur []string
	flush := func() {
		if len(cur) > 0 {
			hunks = append(hunks, strings.TrimRight(strings.Join(cur, "\n"), "\n"))
			cur = nil
		}
	}
	inHunk := false
	for _, l := range strings.Split(diff, "\n") {
		if m := hunkHeader.FindStringSubmatch(l); m != nil {
			flush()
			inHunk = true
			cur = append(cur, m[1])
			continue
		}
		if inHunk {
			cur = append(cur, l)
		}
	}
	flush()
	return hunks
}
