package pkg

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadLocalConfigDefaultsMajorProviderUpgradesEnabled(t *testing.T) {
	dir := t.TempDir()

	configPath := filepath.Join(dir, ".ci-mgmt.yaml")
	if err := os.WriteFile(configPath, []byte("provider: aws\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	config, err := LoadLocalConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if config.DisableMajorProviderUpgrades {
		t.Fatal("expected major provider upgrades to be enabled by default")
	}
}

func TestLoadLocalConfigCanDisableMajorProviderUpgrades(t *testing.T) {
	dir := t.TempDir()

	configPath := filepath.Join(dir, ".ci-mgmt.yaml")
	if err := os.WriteFile(configPath, []byte(`provider: aws
disableMajorProviderUpgrades: true
`), 0o600); err != nil {
		t.Fatal(err)
	}

	config, err := LoadLocalConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if !config.DisableMajorProviderUpgrades {
		t.Fatal("expected local config to disable major provider upgrades")
	}
}
