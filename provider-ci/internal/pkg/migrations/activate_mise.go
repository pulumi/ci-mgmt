package migrations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
)

// activateMise exports mise env variable so the mise toolchain is made
// available to subsequent migrations.
type activateMise struct{}

func (activateMise) Name() string {
	return "Activate mise"
}

func (activateMise) ShouldRun(_ string) bool {
	return true
}

func (activateMise) Migrate(_ string, outDir string) error {
	fmt.Println("Installing dependencies")

	cmd := exec.Command("mise", "trust", ".")
	cmd.Dir = outDir
	_ = cmd.Run() // Error is ignored in case mise isn't present.

	cmd = exec.Command("mise", "install", "--yes")
	cmd.Dir = outDir
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	err := cmd.Run()
	if err != nil {
		fmt.Printf("Failed to install dependencies: %s\n", err)
	}

	buf := &bytes.Buffer{}

	cmd = exec.Command("mise", "env", "--json", "--cd", outDir)
	cmd.Stdout = buf

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("running mise: %w", err)
	}

	var values map[string]string

	if err := json.Unmarshal(buf.Bytes(), &values); err != nil {
		return fmt.Errorf("parsing mise output: %w", err)
	}

	for name, value := range values {
		if err := os.Setenv(name, value); err != nil {
			return fmt.Errorf("setting mise env: %w", err)
		}
	}

	return nil
}
