package comparesdk

import (
	"fmt"
	"strings"
)

// RenderText renders the report as plain text for a CI job log or terminal.
func (r *Report) RenderText() string {
	var sb strings.Builder
	changed := len(r.Diffs)
	fmt.Fprintf(&sb, "shadow-gen diff: %s / %s\n", r.Provider, r.Language)
	fmt.Fprintf(&sb, "  %d files compared, %d identical, %d differ (%.1f%% parity)\n",
		r.TotalFiles, r.IdenticalFiles, changed, r.ParityPercent())

	if !r.HasDiffs() {
		sb.WriteString("  legacy and gen-sdk output match after normalization.\n")
		return sb.String()
	}

	for _, d := range r.Diffs {
		switch d.Status {
		case StatusChanged:
			fmt.Fprintf(&sb, "  ~ %s (%d hunk%s)\n", d.Path, d.HunkCount, plural(d.HunkCount))
		case StatusAdded:
			fmt.Fprintf(&sb, "  + %s (only in gen-sdk)\n", d.Path)
		case StatusRemoved:
			fmt.Fprintf(&sb, "  - %s (only in legacy)\n", d.Path)
		}
		for _, h := range d.SampleHunks {
			for _, line := range strings.Split(h, "\n") {
				fmt.Fprintf(&sb, "      %s\n", line)
			}
		}
		if shown := len(d.SampleHunks); d.Status == StatusChanged && shown < d.HunkCount {
			fmt.Fprintf(&sb, "      ... %d more hunk%s\n", d.HunkCount-shown, plural(d.HunkCount-shown))
		}
	}
	return sb.String()
}

// RenderMarkdown renders the report as GitHub-flavored markdown suitable for
// $GITHUB_STEP_SUMMARY.
func (r *Report) RenderMarkdown() string {
	var sb strings.Builder
	status := "✅ match"
	if r.HasDiffs() {
		status = "❌ differ"
	}
	fmt.Fprintf(&sb, "### shadow-gen diff: `%s` / `%s` — %s\n\n", r.Provider, r.Language, status)
	fmt.Fprintf(&sb, "%d files compared, %d identical, %d differ — **%.1f%% parity**\n\n",
		r.TotalFiles, r.IdenticalFiles, len(r.Diffs), r.ParityPercent())

	if !r.HasDiffs() {
		return sb.String()
	}

	sb.WriteString("| File | Status | Hunks |\n| --- | --- | --- |\n")
	for _, d := range r.Diffs {
		hunks := ""
		if d.Status == StatusChanged {
			hunks = fmt.Sprintf("%d", d.HunkCount)
		}
		fmt.Fprintf(&sb, "| `%s` | %s | %s |\n", d.Path, d.Status, hunks)
	}
	sb.WriteString("\n")

	for _, d := range r.Diffs {
		if len(d.SampleHunks) == 0 {
			continue
		}
		fmt.Fprintf(&sb, "<details><summary><code>%s</code></summary>\n\n```diff\n", d.Path)
		sb.WriteString(strings.Join(d.SampleHunks, "\n"))
		sb.WriteString("\n```\n")
		if shown := len(d.SampleHunks); shown < d.HunkCount {
			fmt.Fprintf(&sb, "\n_... %d more hunk%s_\n", d.HunkCount-shown, plural(d.HunkCount-shown))
		}
		sb.WriteString("</details>\n\n")
	}
	return sb.String()
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
