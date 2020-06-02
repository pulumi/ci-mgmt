export interface RunConfig {
    timeout: string;
    'skip-files': string[];
}

export interface Linters {
    'enable-all': boolean;
    enable: string[];
}

export class PulumiGolangCIConfig {
    run: RunConfig = {
        timeout: '5m',
        'skip-files': [
            'schema.go',
            'pulumiManifest.go',
        ]
    };
    linters: Linters = {
        'enable-all': false,
        enable: [ 'deadcode', 'errcheck', 'goconst', 'gofmt', 'golint',
            'gosec', 'govet', 'ineffassign', 'interfacer', 'lll',
            'megacheck', 'misspell', 'nakedret', 'structcheck', 'unconvert', 'varcheck' ]
    };
}
