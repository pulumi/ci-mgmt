export class GoreleaserConfig {
    constructor(params) {
        Object.assign(this, params);
    }
}
export class PulumiGoreleaserPreConfig extends GoreleaserConfig {
    constructor(name) {
        super();
        this.before = {
            hooks: [
                'cd provider && go mod download'
            ]
        };
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
                    'amd64'
                ],
                main: `./cmd/pulumi-resource-${name}/`,
                ldflags: [`-X github.com/pulumi/pulumi-${name}/provider/pkg/version.Version={{.Tag}}`],
                binary: `pulumi-resource-${name}`
            }];
        this.archives = [{
                name_template: '{{ .Binary }}-{{ .Tag }}-{{ .Os }}-{{ .Arch }}',
                format_overrides: [
                    { goos: 'windows', format: 'zip' },
                ],
                replacements: {
                    amd64: 'x64',
                    '386': 'x86',
                },
                id: 'archive',
            }];
        this.snapshot = {
            name_template: '{{ .Binary }}-{{ .Tag }}-{{ .Os }}-{{ .Arch }}'
        };
        this.changelog = {
            skip: true,
        };
        this.release = {
            disable: true
        };
        this.blobs = [{
                provider: 's3',
                region: 'us-west-2',
                bucket: 'goreleaser',
                folder: 'releases/plugins/',
                ids: ['archive']
            }];
    }
}
export class PulumiGoreleaserConfig extends PulumiGoreleaserPreConfig {
    constructor(name) {
        super(name);
        this.release = {
            disable: false
        };
    }
}
