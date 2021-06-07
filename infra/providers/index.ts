import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';


// grab all the providers from the directory listing
const providers = fs.readdirSync('../../actions/tf-providers/');

for (let provider of providers) {
    let configFile = path.join("../../actions/tf-providers/", provider, "config.yaml")
    const providerConfig = yaml.parse(fs.readFileSync(configFile, 'utf8'))

    const contexts: string[] = [
        "Update Changelog",
        "prerequisites (3.1.301, 1.16.x, 14.x, 3.7)",
        "test (3.1.301, 1.16.x, dotnet, 14.x, 3.7)",
        "test (3.1.301, 1.16.x, go, 14.x, 3.7)",
        "test (3.1.301, 1.16.x, nodejs, 14.x, 3.7)",
        "test (3.1.301, 1.16.x, python, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.16.x, dotnet, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.16.x, go, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.16.x, nodejs, 14.x, 3.7)",
        "build_sdk (3.1.301, 1.16.x, python, 14.x, 3.7)",
    ];

    // If the lint step is null then we are using the default which is true
    // if we pass a lint value, it's more than likely to set it to false
    if (providerConfig.lint == null) {
        contexts.push("lint (1.16.x)")
        contexts.push("lint-sdk (1.16.x)")
    } else {
        console.log(`Skipping linting for ${provider}: ${providerConfig.lint}`)
    }

    // enable branchProtection
    const branchProtection = new github.BranchProtection(`${provider}-branchprotection`, {
        repositoryId: `pulumi-${provider}`,
        pattern: 'master',
        requiredStatusChecks: [{
            strict: false,
            contexts: contexts,
        }]
    })
}
