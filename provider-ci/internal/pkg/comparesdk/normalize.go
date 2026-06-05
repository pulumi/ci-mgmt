// Package comparesdk implements the "shadow-gen diff": it generates a
// provider's SDK both ways - via the legacy per-provider codegen binary
// (pulumi-tfgen-<provider> / pulumi-gen-<provider>) and via the generic
// `pulumi package gen-sdk` - from the same schema.json, then reports the
// differences between the two trees.
//
// The comparison is purely a reporting tool: it never touches a provider's
// committed sdk/ directory (callers generate into isolated temp dirs) and it
// only ever reads files, so there is no risk of dropping committed state.
//
// Before two files are compared they are passed through Normalize, a documented
// allowlist of cosmetic transformations. Anything that survives normalization
// is treated as a real, un-allowlisted difference and causes the caller to exit
// non-zero. Normalize is the contract that defines "the two generators agree":
// every step in it is a difference we have decided is cosmetic and not a
// codegen-correctness concern. New steps should be added only with a comment
// explaining the difference and why it is safe to ignore.
//
// This allowlist is intentionally bespoke rather than a library: it encodes
// project-specific decisions about which legacy-vs-gen-sdk differences are
// cosmetic for this migration, not general text canonicalization. The diffing
// itself is delegated to git (see gitdiff.go); this layer only decides what git
// is allowed to see.
package comparesdk

import (
	"bytes"
	"regexp"
	"strings"
)

var (
	crlf                 = regexp.MustCompile(`\r\n`)
	trailingWhitespace   = regexp.MustCompile(`[ \t]+\n`)
	pluginVersionPattern = regexp.MustCompile(`("version"\s*:\s*)"[^"]*"`)
)

// Normalize applies the documented cosmetic-diff allowlist to one file's
// content. relPath is the file's path relative to the language SDK root (e.g.
// "pulumi-plugin.json"). Each step is deliberately conservative, absorbing a
// difference determined by how a file is built rather than what the codegen
// chose to emit.
func Normalize(relPath string, content []byte) []byte {
	// Line endings: codegen output may use CRLF or LF depending on platform;
	// line-ending style is not a codegen-correctness difference.
	content = crlf.ReplaceAll(content, []byte("\n"))

	// Trailing whitespace on a line is invisible and not a semantic difference
	// between the two generators.
	content = trailingWhitespace.ReplaceAll(content, []byte("\n"))

	// Final newline: a file ending with zero, one, or several blank lines is
	// cosmetic; we compare with exactly one trailing newline.
	content = bytes.TrimRight(content, "\n")
	if len(content) > 0 {
		content = append(content, '\n')
	}

	// pulumi-plugin.json embeds the build-time provider version. The legacy path
	// bakes it via ldflags while gen-sdk takes --version, so the literal string
	// can differ even when the two agree structurally; the version is not part
	// of codegen correctness.
	if isPluginJSON(relPath) {
		content = pluginVersionPattern.ReplaceAll(content, []byte(`${1}"0.0.0-NORMALIZED"`))
	}

	return content
}

// isPluginJSON reports whether relPath is a pulumi-plugin.json file. These
// appear at the SDK root and, for some languages, nested under a package dir.
func isPluginJSON(relPath string) bool {
	return relPath == "pulumi-plugin.json" || strings.HasSuffix(relPath, "/pulumi-plugin.json")
}
