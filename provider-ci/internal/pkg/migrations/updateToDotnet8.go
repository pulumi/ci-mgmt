package migrations

import (
	_ "embed"
	"fmt"
	"os/exec"
	"strings"
)

type updateToDotnet8 struct{}

func (updateToDotnet8) Name() string {
	return "Update TargetFramework to net8"
}
func (updateToDotnet8) ShouldRun(templateName string) bool {
	return templateName == "bridged-provider" || templateName == "external-bridged-provider"
}
func (updateToDotnet8) Migrate(templateName, outDir string) error {

	// Find modified .go files and run gofumpt on them
	ls := exec.Command("git", "ls-files", "examples")
	ls.Dir = outDir
	lsOutput, err := ls.Output()
	if err != nil {
		return fmt.Errorf("error getting files: %w", err)
	}
	if len(lsOutput) == 0 {
		return nil
	}

	allFiles := strings.Split(string(lsOutput), "\n")
	csprojFiles := []string{}
	for _, line := range allFiles {
		if strings.HasSuffix(line, ".csproj") {
			csprojFiles = append(csprojFiles, line)
		}
	}
	if len(csprojFiles) == 0 {
		return nil
	}

	for _, file := range csprojFiles {
		// sed -i '' -E 's/<TargetFramework>net6.0<\/TargetFramework>/<TargetFramework>net8.0<\/TargetFramework>/' examples/dotnet/provider-xyz-native.csproj
		sed := exec.Command("sed", "-i", "", "-E", `s/<TargetFramework>net6.0<\/TargetFramework>/<TargetFramework>net8.0<\/TargetFramework>/`, file)
		sed.Dir = outDir
		_, err := sed.Output()
		if err != nil {
			return fmt.Errorf("error writing to %q: %w", file, err)
		}
	}

	return nil
}
