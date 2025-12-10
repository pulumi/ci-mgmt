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

type sectionEntry struct {
	key   string
	value string
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

func (t *tomlFile) ensureSectionEntries(section string, entries []sectionEntry) (bool, error) {
	if len(entries) == 0 {
		return false, nil
	}

	formatted := make([]struct {
		key  string
		line string
	}, 0, len(entries))
	for _, entry := range entries {
		if entry.key == "" {
			continue
		}
		formatted = append(formatted, struct {
			key  string
			line string
		}{
			key:  entry.key,
			line: formatTomlAssignment(entry.key, entry.value),
		})
	}
	if len(formatted) == 0 {
		return false, nil
	}

	content := string(t.content)
	lines := strings.Split(content, "\n")
	sectionHeader := fmt.Sprintf("[%s]", section)
	sectionIdx := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == sectionHeader {
			sectionIdx = i
			break
		}
	}

	if sectionIdx == -1 {
		var builder strings.Builder
		trimmed := strings.TrimSpace(content)
		if trimmed != "" {
			builder.WriteString(content)
			if !strings.HasSuffix(content, "\n") {
				builder.WriteString("\n")
			}
			builder.WriteString("\n")
		}
		builder.WriteString(sectionHeader)
		builder.WriteString("\n")
		for _, entry := range formatted {
			builder.WriteString(entry.line)
			builder.WriteString("\n")
		}
		t.content = []byte(builder.String())
		return true, nil
	}

	insertionIdx := len(lines)
	existing := make(map[string]int)
	for i := sectionIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])
		if len(trimmed) > 0 && trimmed[0] == '[' && strings.HasSuffix(trimmed, "]") {
			insertionIdx = i
			break
		}
		if trimmed == "" {
			continue
		}
		if key, ok := parseTomlKey(trimmed); ok {
			existing[key] = i
		}
	}

	seen := make(map[string]struct{}, len(formatted))
	for _, entry := range formatted {
		if _, ok := existing[entry.key]; ok {
			seen[entry.key] = struct{}{}
		}
	}

	additions := make([]string, 0, len(formatted))
	for _, entry := range formatted {
		if _, ok := seen[entry.key]; ok {
			continue
		}
		additions = append(additions, entry.line)
	}

	if len(additions) == 0 {
		return false, nil
	}

	newLines := make([]string, 0, len(lines)+len(additions)+1)
	newLines = append(newLines, lines[:insertionIdx]...)
	for len(newLines) > 0 && strings.TrimSpace(newLines[len(newLines)-1]) == "" {
		newLines = newLines[:len(newLines)-1]
	}
	newLines = append(newLines, additions...)
	if insertionIdx < len(lines) && strings.TrimSpace(lines[insertionIdx]) != "" {
		newLines = append(newLines, "")
	}
	newLines = append(newLines, lines[insertionIdx:]...)
	t.content = []byte(strings.Join(newLines, "\n"))
	return true, nil
}

func formatTomlAssignment(key, value string) string {
	return fmt.Sprintf("%s = %s", formatTomlKey(key), formatTomlString(value))
}

func formatTomlKey(key string) string {
	if key == "" {
		return "" // caller filters empty keys
	}
	for _, r := range key {
		if isTomlBareKeyChar(r) {
			continue
		}
		return fmt.Sprintf("\"%s\"", escapeTomlString(key))
	}
	return key
}

func isTomlBareKeyChar(r rune) bool {
	if r >= 'a' && r <= 'z' {
		return true
	}
	if r >= 'A' && r <= 'Z' {
		return true
	}
	if r >= '0' && r <= '9' {
		return true
	}
	switch r {
	case '-', '_':
		return true
	default:
		return false
	}
}

func formatTomlString(value string) string {
	return fmt.Sprintf("\"%s\"", escapeTomlString(value))
}

func escapeTomlString(value string) string {
	return strings.ReplaceAll(value, "\"", "\\\"")
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

// parseTomlValue extracts the value portion of a TOML line, returning false when the line is not an assignment.
func parseTomlValue(line string) (string, bool) {
	if line == "" || strings.HasPrefix(line, "#") {
		return "", false
	}
	eq := strings.Index(line, "=")
	if eq == -1 {
		return "", false
	}
	value := strings.TrimSpace(line[eq+1:])

	// Strip inline comments first (but only outside of quoted strings)
	// We need to find the # that's not inside a quoted string
	var inString bool
	var stringChar byte
	commentIdx := -1
	for i := 0; i < len(value); i++ {
		ch := value[i]
		if !inString {
			if ch == '"' || ch == '\'' {
				inString = true
				stringChar = ch
			} else if ch == '#' {
				commentIdx = i
				break
			}
		} else {
			if ch == stringChar && (i == 0 || value[i-1] != '\\') {
				inString = false
			}
		}
	}

	if commentIdx != -1 {
		value = strings.TrimSpace(value[:commentIdx])
	}

	// Remove quotes if present
	if len(value) >= 2 {
		if (value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'') {
			value = value[1 : len(value)-1]
		}
	}

	return value, true
}

// getSection returns all key-value entries in a given section
func (t *tomlFile) getSection(section string) []sectionEntry {
	content := string(t.content)
	lines := strings.Split(content, "\n")
	sectionHeader := fmt.Sprintf("[%s]", section)
	sectionIdx := -1

	// Find the section header
	for i, line := range lines {
		if strings.TrimSpace(line) == sectionHeader {
			sectionIdx = i
			break
		}
	}

	if sectionIdx == -1 {
		return nil
	}

	var entries []sectionEntry
	// Parse all entries in the section until we hit another section or end of file
	for i := sectionIdx + 1; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])

		// Stop if we hit another section
		if len(trimmed) > 0 && trimmed[0] == '[' && strings.HasSuffix(trimmed, "]") {
			break
		}

		// Skip empty lines and comments
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// Parse the key-value pair
		if key, ok := parseTomlKey(trimmed); ok {
			if value, ok := parseTomlValue(trimmed); ok {
				entries = append(entries, sectionEntry{
					key:   key,
					value: value,
				})
			}
		}
	}

	return entries
}
