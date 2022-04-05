export interface RunConfig {
  timeout: string;
  "skip-files": string[];
}

export interface Linters {
  "enable-all": boolean;
  enable: string[];
}

export class PulumiGolangCIConfig {
  constructor(timeout: string) {
    this.run = {
      timeout: timeout,
      "skip-files": ["schema.go", "pulumiManifest.go"],
    };
  }
  run: RunConfig;
  linters: Linters = {
    "enable-all": false,
    enable: [
      "deadcode",
      "errcheck",
      "goconst",
      "gofmt",
      "golint",
      "gosec",
      "govet",
      "ineffassign",
      "interfacer",
      "lll",
      "megacheck",
      "misspell",
      "nakedret",
      "structcheck",
      "unconvert",
      "varcheck",
    ],
  };
}
