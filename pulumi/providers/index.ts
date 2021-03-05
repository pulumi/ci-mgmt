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
        "prerequisites",
        "test (3.1.301, 1.16.x, dotnet, 13.x, 3.7)",
        "test (3.1.301, 1.16.x, go, 13.x, 3.7)",
        "test (3.1.301, 1.16.x, nodejs, 13.x, 3.7)",
        "test (3.1.301, 1.16.x, python, 13.x, 3.7)",
        "build_sdk (3.1.301 1.16.x, dotnet, 13.x, 3.7)",
        "build_sdk (3.1.301, 1.16.x, go, 13.x, 3.7)",
        "build_sdk (3.1.301, 1.16.x, nodejs, 13.x, 3.7)",
        "build_sdk (3.1.301, 1.16.x, python, 13.x, 3.7)",
    ];

    // If the lint step is null then we are using the default which is true
    // if we pass a lint value, it's more than likely to set it to false
    if (providerConfig.lint == null) {
        contexts.push("lint")
        contexts.push("lint-sdk")
    } else {
        console.log(`Skipping linting for ${provider}: ${providerConfig.lint}`)
    }

    // enable branchProtection
    const branchProtection = new github.BranchProtection(`${provider}-branchprotection`, {
        repository: `pulumi-${provider}`,
        branch: 'master',
        requiredStatusChecks: {
            contexts: contexts,
        }
    })
}
