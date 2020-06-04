import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from 'fs';
import * as path from 'path';


// FIXME: let's walk the tree here instead of hardcoding
const repoFiles = [
    '.golangci.yml',
    '.goreleaser.yml',
    '.goreleaser.prerelease.yml',
    '.github/workflows/master.yml',
    '.github/workflows/prerelease.yml',
    '.github/workflows/pull-request.yml',
    '.github/workflows/release.yml',
    '.github/workflows/pr-automation.yml'
]

// const providers = fs.readdirSync('../providers');
const providers = ['kong', 'rancher2']

for (let provider of providers) {

    const automationBranch = new github.Branch(`${provider}-automated`, {
        repository: `pulumi-${provider}`,
        branch: 'pulumi-automation',
        sourceBranch: 'pulumi-test',
    })

    for (let file of repoFiles) {
        let name_array = file.split('/')
        let name = name_array[name_array.length - 1]

        const repoFile = new github.RepositoryFile(`${provider}-${name.split('.').join('-')}`, {
            repository: `pulumi-${provider}`,
            file: `${file}`,
            content: fs.readFileSync(`../providers/${provider}/repo/${file}`).toString(),
            branch: automationBranch.ref,
        }, { parent: automationBranch })

    }
}




