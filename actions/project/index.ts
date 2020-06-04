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
]


for (let file of repoFiles) {
    let name_array = file.split('/')
    let name = name_array[name_array.length - 1]
    const gitFile = new github.RepositoryFile(`kong-${name}`, {
        repository: 'pulumi-kong',
        file: `../providers/kong/repo/${file}`,
        content: fs.readFileSync(`../providers/kong/repo/${file}`).toString(),
        branch: 'pulumi-test',
    })
}




