import * as param from '@jkcfg/std/param';

const majVersion = param.Number('major-version', 2);
const skipTfGen = param.Boolean('skipTfGen', false);
const customLdFlag = param.String('customLdFlag') || "";

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
    replacements?: {[k: string]: string};
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
    filters?: Filters,
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

export class GoreleaserConfig {
    name: string;
    builds: Build[];
    archives: Archive[];
    before: Before;
    snapshot: Snapshot;
    changelog: Changelog;
    release: Release;
    blobs: Blob[];
    constructor(params?: Partial<GoreleaserConfig>) {
        Object.assign(this, params)
    }
}

export class PulumiGoreleaserPreConfig extends GoreleaserConfig {
    before: Before;
    builds: Build[];
    archives: Archive[];
    snapshot: Snapshot;
    changelog: Changelog;
    release: Release;
    blobs: Blob[];

    constructor(name: string) {
        super();

        let ldflags: string[];

        if (majVersion! > 1 ) {
            ldflags = [ `-X github.com/pulumi/pulumi-${name}/provider/v${majVersion}/pkg/version.Version={{.Tag}}` ]
        } else {
            ldflags = [ `-X github.com/pulumi/pulumi-${name}/provider/pkg/version.Version={{.Tag}}` ]
        }

        if (customLdFlag != "") {
            ldflags.push(customLdFlag)
        }

        if (!skipTfGen) {
            this.before = {
                hooks: [
                    'make tfgen'
                ]
            }
        }
        this.builds = [{
            dir: 'provider',
            env: [
                'CGO_ENABLED=0',
                'GO111MODULE=on'
            ],
            goos: [
                'darwin',
                'windows',
                'linux',
            ],
            goarch: [
                'amd64',
                'arm64',
            ],
            main: `./cmd/pulumi-resource-${name}/`,
            ldflags: ldflags,
            binary: `pulumi-resource-${name}`
        }]
        this.archives = [{
            name_template: '{{ .Binary }}-{{ .Tag }}-{{ .Os }}-{{ .Arch }}',
            id: 'archive',
        }]
        this.snapshot = {
            name_template: '{{ .Tag }}-SNAPSHOT'
        }
        this.changelog = {
            skip: true,
        }
        this.release = {
            disable: true
        }
        this.blobs = [{
            provider: 's3',
            region: 'us-west-2',
            bucket: 'get.pulumi.com',
            folder: 'releases/plugins/',
            ids: [ 'archive' ]
        }]


    }
}

export class PulumiGoreleaserConfig extends PulumiGoreleaserPreConfig {
    constructor(name: string) {
        super(name);
        this.release = {
            disable: false
        }
        this.changelog = {
            use: 'git',
            sort: 'asc',
            filters: {
                exclude: [
                    "Merge branch",
                    "Merge pull request"
                ],
            },
        }
    }
}
