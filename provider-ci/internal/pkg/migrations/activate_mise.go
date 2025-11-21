package migrations

import (
	"bytes"
	"encoding/json"
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
	buf := &bytes.Buffer{}

	cmd := exec.Command("mise", "env", "--json", "--cd", outDir)
	cmd.Stdout = buf

	if err := cmd.Run(); err != nil {
		return err
	}

	var values map[string]string

	if err := json.Unmarshal(buf.Bytes(), &values); err != nil {
		return err
	}

	for name, value := range values {
		_ = os.Setenv(name, value)
	}

	return nil
}
