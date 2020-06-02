export class PulumiGolangCIConfig {
    constructor() {
        this.run = {
            timeout: '5m',
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
