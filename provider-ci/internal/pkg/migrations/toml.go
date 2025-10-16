package migrations

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

// tomlFile keeps an in-memory representation of a TOML document and the path it mirrors.
type tomlFile struct {
	content []byte
	path    string
}

type toolEntry struct {
	name    string
	version string
}

// newTomlFile loads the TOML file at path, returning an empty document if the file does not exist.
func newTomlFile(path string) (*tomlFile, error) {
	file, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			t := &tomlFile{
				content: []byte{},
				path:    path,
			}
			return t, nil
		}
		return nil, fmt.Errorf("error reading %s: %w", path, err)
	}
	return &tomlFile{
		content: file,
		path:    path,
	}, nil
}

// writeFile flushes the in-memory TOML content to disk.
func (t *tomlFile) writeFile() error {
	if err := os.WriteFile(t.path, t.content, 0644); err != nil {
		return fmt.Errorf("error writing new file %s: %w", t.path, err)
	}
	return nil
}

// ensureToolsEntries guarantees that each provided tool entry is present in the [tools] section,
// returning true when the document was mutated.
func (t *tomlFile) ensureToolsEntries(entries []toolEntry) (bool, error) {
	if len(entries) == 0 {
		return false, nil
	}

	lines := strings.Split(string(t.content), "\n")
	toolsIdx := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == "[tools]" {
			toolsIdx = i
			break
		}
	}
	if toolsIdx == -1 {
		return false, fmt.Errorf("could not find [tools] section in mise.toml")
	}

	existing := make(map[string]struct{})
	insertionIdx := len(lines)
	for i := toolsIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if len(trimmed) > 0 && trimmed[0] == '[' && strings.HasSuffix(trimmed, "]") {
			insertionIdx = i
			break
		}

		if key, ok := parseTomlKey(trimmed); ok {
			existing[key] = struct{}{}
		}
	}

	additions := make([]string, 0, len(entries))
	for _, entry := range entries {
		if _, ok := existing[entry.name]; ok {
			continue
		}
		additions = append(additions, fmt.Sprintf("\"%s\" = \"%s\"", entry.name, entry.version))
	}

	if len(additions) == 0 {
		return false, nil
	}

	newLines := make([]string, 0, len(lines)+len(additions)+1)
	newLines = append(newLines, lines[:insertionIdx]...)
	if insertionIdx > toolsIdx+1 {
		prev := lines[insertionIdx-1]
		if strings.TrimSpace(prev) != "" {
			newLines = append(newLines, "")
		}
	}
	newLines = append(newLines, additions...)
	if insertionIdx < len(lines) && strings.TrimSpace(lines[insertionIdx]) != "" {
		newLines = append(newLines, "")
	}
	newLines = append(newLines, lines[insertionIdx:]...)
	t.content = []byte(strings.Join(newLines, "\n"))

	return true, nil
}

// parseTomlKey extracts the key portion of a TOML line, returning false when the line is not an assignment.
func parseTomlKey(line string) (string, bool) {
	if line == "" || strings.HasPrefix(line, "#") {
		return "", false
	}
	eq := strings.Index(line, "=")
	if eq == -1 {
		return "", false
	}
	key := strings.TrimSpace(line[:eq])
	if len(key) >= 2 {
		if (key[0] == '"' && key[len(key)-1] == '"') || (key[0] == '\'' && key[len(key)-1] == '\'') {
			key = key[1 : len(key)-1]
		}
	}
	return key, true
}
