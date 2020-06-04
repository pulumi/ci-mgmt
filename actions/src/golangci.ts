import * as param from '@jkcfg/std/param';

const timeout = param.String('golangci-timeout', '10m');

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
        timeout: timeout!,
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
