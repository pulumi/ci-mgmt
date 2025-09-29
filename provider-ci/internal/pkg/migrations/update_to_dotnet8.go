package migrations

import (
	"fmt"
	"path/filepath"
	"regexp"

	"github.com/bitfield/script"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/contract"
)

type updateToDotnet8 struct{}

func (updateToDotnet8) Name() string {
	return "Update TargetFramework to net8"
}

func (updateToDotnet8) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider" || templateName == "external-bridged-provider"
}

func (updateToDotnet8) Migrate(templateName, outDir string) error {
	csprojFiles, err := script.
		Exec(fmt.Sprintf("git -C %q ls-files examples tests", outDir)).
		MatchRegexp(regexp.MustCompile(`\.csproj$`)).
		Slice()
	if err != nil {
		return fmt.Errorf("error getting files: %w", err)
	}

	for _, file := range csprojFiles {
		path := filepath.Join(outDir, file)
		_, err := FileContent(path).
			Replace(`<TargetFramework>net6.0</TargetFramework>`, `<TargetFramework>net8.0</TargetFramework>`).
			WriteFile(path)
		if err != nil {
			return fmt.Errorf("error writing to %q: %w", path, err)
		}
	}

	return nil
}

// FileContent reads the content of a file and returns it as a pipe.
// Unlike script.File, the file is not kept open after the pipe is created.
// This is useful for reading the content of a file and then writing back to that same file.
func FileContent(path string) *script.Pipe {
	p := script.File(path)
	defer contract.IgnoreError(p.Close)
	s, err := p.String()
	if err != nil {
		r := script.NewPipe()
		r.SetError(err)
		return r
	}
	return script.Echo(s)
}
