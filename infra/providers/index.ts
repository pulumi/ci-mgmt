import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';


// grab all the providers from the directory listing
const providers = fs.readdirSync('../../provider-ci/providers/');

for (let provider of providers) {
    let configFile = path.join("../../provider-ci/providers/", provider, "config.yaml")
    const providerConfig = yaml.parse(fs.readFileSync(configFile, 'utf8'))

    const contexts: string[] = [
        "Update Changelog",
        "prerequisites (3.1.301, 1.18.x, 14.x, 3.7)",
        "test (3.1.301, 1.18.x, dotnet, 14.x, 3.7)",
        "test (3.1.301, 1.18.x, go, 14.x, 3.7)",
        "test (3.1.301, 1.18.x, nodejs, 14.x, 3.7)",
        "test (3.1.301, 1.18.x, python, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.18.x, dotnet, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.18.x, go, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.18.x, nodejs, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.18.x, python, 14.x, 3.7)",
    ];

    // If the lint step is null then we are using the default which is true
    // if we pass a lint value, it's more than likely to set it to false
    if (providerConfig.lint == null) {
        contexts.push("lint (1.18.x)")
        contexts.push("lint-sdk (1.18.x)")
    } else {
        console.log(`Skipping linting for ${provider}: ${providerConfig.lint}`)
    }

    // enable branchProtection
    const branches: string[] = [
        "master",
        "main"
    ]
    for (let branch of branches) {
        const masterBranchProtection = new github.BranchProtection(`${provider}-${branch}-branchprotection`, {
            repositoryId: `pulumi-${provider}`,
            pattern: `${branch}`,
            requiredStatusChecks: [{
                strict: false,
                contexts: contexts,
            }]
        })
    }
}
