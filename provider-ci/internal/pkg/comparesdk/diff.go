package comparesdk

import (
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"slices"
)

// Status classifies how a single file differs between the two SDK trees.
type Status string

const (
	// StatusChanged means the file exists in both trees but differs after
	// normalization.
	StatusChanged Status = "changed"
	// StatusAdded means the file exists only in the gen-sdk tree.
	StatusAdded Status = "added"
	// StatusRemoved means the file exists only in the legacy tree.
	StatusRemoved Status = "removed"
)

// FileDiff is a single file's un-allowlisted difference.
type FileDiff struct {
	// Path is the file path relative to the language SDK root.
	Path string
	// Status is how the file differs.
	Status Status
	// HunkCount is the number of contiguous changed regions (only meaningful
	// for StatusChanged).
	HunkCount int
	// SampleHunks holds up to a caller-chosen number of rendered unified-diff
	// hunks, for inclusion in the report.
	SampleHunks []string
}

// Report is the structured result of comparing one provider+language.
type Report struct {
	Provider string
	Language string
	// TotalFiles is the size of the union of files across both trees.
	TotalFiles int
	// IdenticalFiles is the number of files equal after normalization.
	IdenticalFiles int
	// Diffs holds every file with an un-allowlisted difference, sorted by path.
	Diffs []FileDiff
}

// HasDiffs reports whether any un-allowlisted difference was found.
func (r *Report) HasDiffs() bool { return len(r.Diffs) > 0 }

// ParityPercent returns the percentage of files that are identical after
// normalization. An empty comparison (no files on either side) is 100%.
func (r *Report) ParityPercent() float64 {
	if r.TotalFiles == 0 {
		return 100
	}
	return 100 * float64(r.IdenticalFiles) / float64(r.TotalFiles)
}

// CompareOptions tune a comparison.
type CompareOptions struct {
	// SampleHunks is the maximum number of diff hunks recorded per changed file
	// for the report. Zero means a small default. The full hunk count is always
	// recorded regardless of this cap.
	SampleHunks int
	// ContextLines is the number of unchanged lines shown around each diff hunk.
	// Zero means a small default.
	ContextLines int
}

func (o CompareOptions) withDefaults() CompareOptions {
	if o.SampleHunks == 0 {
		o.SampleHunks = 3
	}
	if o.ContextLines == 0 {
		o.ContextLines = 3
	}
	return o
}

// Compare walks the legacy and gen-sdk SDK trees for a single language,
// normalizes each file via the allowlist, and reports every surviving
// difference. legacyDir and genSDKDir are the language SDK roots (e.g. the
// directories that contain pulumi-plugin.json), not the parent sdk/ dir.
func Compare(provider, language, legacyDir, genSDKDir string, opts CompareOptions) (*Report, error) {
	opts = opts.withDefaults()

	legacyFiles, err := listFiles(legacyDir)
	if err != nil {
		return nil, fmt.Errorf("listing legacy SDK files in %s: %w", legacyDir, err)
	}
	genFiles, err := listFiles(genSDKDir)
	if err != nil {
		return nil, fmt.Errorf("listing gen-sdk files in %s: %w", genSDKDir, err)
	}

	union := map[string]struct{}{}
	maps.Copy(union, legacyFiles)
	maps.Copy(union, genFiles)
	paths := slices.Sorted(maps.Keys(union))

	report := &Report{Provider: provider, Language: language, TotalFiles: len(union)}

	for _, p := range paths {
		_, inLegacy := legacyFiles[p]
		_, inGen := genFiles[p]

		switch {
		case inLegacy && !inGen:
			report.Diffs = append(report.Diffs, FileDiff{Path: p, Status: StatusRemoved})
		case !inLegacy && inGen:
			report.Diffs = append(report.Diffs, FileDiff{Path: p, Status: StatusAdded})
		default:
			legacyContent, err := os.ReadFile(filepath.Join(legacyDir, p))
			if err != nil {
				return nil, fmt.Errorf("reading %s: %w", p, err)
			}
			genContent, err := os.ReadFile(filepath.Join(genSDKDir, p))
			if err != nil {
				return nil, fmt.Errorf("reading %s: %w", p, err)
			}
			ln := Normalize(p, legacyContent)
			gn := Normalize(p, genContent)
			if string(ln) == string(gn) {
				report.IdenticalFiles++
				continue
			}
			hunks, err := gitHunks(ln, gn, opts.ContextLines)
			if err != nil {
				return nil, fmt.Errorf("diffing %s: %w", p, err)
			}
			report.Diffs = append(report.Diffs, FileDiff{
				Path:        p,
				Status:      StatusChanged,
				HunkCount:   len(hunks),
				SampleHunks: hunks[:min(len(hunks), opts.SampleHunks)],
			})
		}
	}

	return report, nil
}

// listFiles returns the set of regular files under root, keyed by their path
// relative to root (with forward slashes). A non-existent root yields an empty
// set rather than an error: a language may be absent from one generator.
func listFiles(root string) (map[string]struct{}, error) {
	files := map[string]struct{}{}
	info, err := os.Stat(root)
	if err != nil {
		if os.IsNotExist(err) {
			return files, nil
		}
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", root)
	}
	err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		files[filepath.ToSlash(rel)] = struct{}{}
		return nil
	})
	return files, err
}
