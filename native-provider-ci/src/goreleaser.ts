export interface Build {
  id?: string;
  dir?: string;
  main?: string;
  binary?: string;
  flags?: string[];
  asmflags?: string[];
  gcflags?: string[];
  ldflags?: string[];
  env?: string[];
  goos?: string[];
  goarch?: string[];
  goarm?: string[];
  skip?: boolean;
  ignore?: Ignores[];
}

export interface FormatOverride {
  goos?: string;
  format?: string;
}
export interface Archive {
  id?: string;
  name_template?: string;
  builds?: string[];
  wrap_in_directory?: boolean;
  format?: string;
  format_overrides?: FormatOverride[];
  replacements?: { [k: string]: string };
}

export interface Ignores {
  goos?: string;
  goarch?: string;
}

export interface Before {
  hooks?: string[];
}

export interface Snapshot {
  name_template?: string;
}

export interface Changelog {
  skip?: boolean;
  use?: string;
  sort?: string;
  filters?: Filters;
}

export interface Filters {
  exclude?: string[];
}

export interface Release {
  disable?: boolean;
  prerelease?: boolean;
}

export interface Blob {
  provider?: string;
  region?: string;
  bucket?: string;
  folder?: string;
  ids?: string[];
}

export interface GoreleaserConfig {
  name?: string;
  builds: Build[];
  archives: Archive[];
  before?: Before;
  snapshot: Snapshot;
  changelog: Changelog;
  release: Release;
  blobs: Blob[];
}

interface GoReleaserOpts {
  provider: string;
  skipWindowsArmBuild: boolean;
  "major-version": number;
  providerVersion: string;
  skipCodegen: boolean;
}

export class PulumiGoreleaserPreConfig implements GoreleaserConfig {
  name?: string;
  before?: Before;
  builds: Build[];
  archives: Archive[];
  snapshot: Snapshot;
  changelog: Changelog;
  release: Release;
  blobs: Blob[];

  constructor(opts: GoReleaserOpts) {
    let ldflags: string[];
    const ignores: Ignores[] = [];

    if (opts.skipWindowsArmBuild) {
      ignores.push({ goos: "windows", goarch: "arm64" });
    }

    if (opts["major-version"] > 1) {
      ldflags = [
        `-X github.com/pulumi/pulumi-${opts.provider}/provider/v${opts["major-version"]}/pkg/version.Version={{.Tag}}`,
      ];
    } else {
      ldflags = [
        `-X github.com/pulumi/pulumi-${opts.provider}/provider/pkg/version.Version={{.Tag}}`,
      ];
    }

    if (opts.providerVersion !== "") {
      ldflags.push(`-X ${opts.providerVersion}={{.Tag}}`);
    }

    if (!opts.skipCodegen) {
      if (opts.provider === "command") {
        this.before = {
          hooks: ["make codegen"],
        };
      }
      if (opts.provider === "kubernetes") {
        this.before = {
          hooks: [
            "make k8sgen",
            "make openapi_file",
            "make schema",
            "make k8sprovider",
          ],
        };
      }
      if (
        opts.provider === "aws-native" ||
        opts.provider === "azure-native" ||
        opts.provider === "google-native"
      ) {
        this.before = {
          hooks: [
            "make init_submodules",
            "make codegen",
            "make generate_schema",
          ],
        };
      }
    }
    this.builds = [
      {
        dir: "provider",
        env: ["CGO_ENABLED=0", "GO111MODULE=on"],
        goos: ["darwin", "windows", "linux"],
        goarch: ["amd64", "arm64"],
        ignore: ignores,
        main: `./cmd/pulumi-resource-${opts.provider}/`,
        ldflags: ldflags,
        binary: `pulumi-resource-${opts.provider}`,
      },
    ];
    // Don't disable CGO for azure-native and aws-native to support mac users
    if (opts.provider === "azure-native" || opts.provider === "aws-native") {
      this.builds = [
        {
          dir: "provider",
          env: ["GO111MODULE=on"],
          goos: ["darwin", "windows", "linux"],
          goarch: ["amd64", "arm64"],
          ignore: ignores,
          main: `./cmd/pulumi-resource-${opts.provider}/`,
          ldflags: ldflags,
          binary: `pulumi-resource-${opts.provider}`,
        },
      ];
    }
    this.archives = [
      {
        name_template: "{{ .Binary }}-{{ .Tag }}-{{ .Os }}-{{ .Arch }}",
        id: "archive",
      },
    ];
    this.snapshot = {
      name_template: "{{ .Tag }}-SNAPSHOT",
    };
    this.changelog = {
      skip: true,
    };
    this.release = {
      disable: true,
    };
    this.blobs = [
      {
        provider: "s3",
        region: "us-west-2",
        bucket: "get.pulumi.com",
        folder: "releases/plugins/",
        ids: ["archive"],
      },
    ];
  }
}

export class PulumiGoreleaserConfig extends PulumiGoreleaserPreConfig {
  constructor(opts: GoReleaserOpts) {
    super(opts);
    this.release = {
      disable: false,
    };
    this.changelog = {
      skip: true,
    };
  }
}
