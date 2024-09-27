package pkg

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/imdario/mergo"
	"gopkg.in/yaml.v3"
)

type Config map[string]any

func LoadLocalConfig(path string) (Config, error) {
	localConfigBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("error reading config file %s: %w", path, err)
	}

	var localConfig map[string]interface{}
	err = yaml.Unmarshal(localConfigBytes, &localConfig)
	if err != nil {
		return nil, err
	}
	return localConfig, nil
}

func (c Config) WithTemplateDefaults() (Config, error) {
	configForTemplate, err := loadDefaultConfig()
	if err != nil {
		return nil, err
	}
	err = mergo.Merge(&configForTemplate, &c, mergo.WithOverride)
	if err != nil {
		return nil, err
	}
	return configForTemplate, nil
}

func loadDefaultConfig() (Config, error) {
	var config map[string]interface{}

	configBytes, err := templateFS.ReadFile(filepath.Join("templates", "defaults.config.yaml"))
	if err != nil {
		return nil, fmt.Errorf("error reading embedded defaults config file: %w", err)
	}
	err = yaml.Unmarshal(configBytes, &config)
	if err != nil {
		return nil, fmt.Errorf("error parsing embedded defaults config file: %w", err)
	}
	return config, nil
}
