import * as param from '@jkcfg/std/param';
const timeout = param.String('golangci-timeout', '10m');
export class PulumiGolangCIConfig {
    constructor() {
        this.run = {
            timeout: timeout,
            'skip-files': [
                'schema.go',
                'pulumiManifest.go',
            ]
        };
        this.linters = {
            'enable-all': false,
            enable: ['deadcode', 'errcheck', 'goconst', 'gofmt', 'golint',
                'gosec', 'govet', 'ineffassign', 'interfacer', 'lll',
                'megacheck', 'misspell', 'nakedret', 'structcheck', 'unconvert', 'varcheck']
        };
    }
}
