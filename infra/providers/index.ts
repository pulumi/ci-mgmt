import * as pulumi from "@pulumi/pulumi";
import * as github from "@pulumi/github";
import * as fs from 'fs';


// grab all the providers from their directory listing
const tfProviders = fs.readdirSync('../../provider-ci/providers/');
const nativeProviders = fs.readdirSync("../../native-provider-ci/providers/")

function hasManagedBranchProtection(provider: string): boolean {
    // Some, but not all of the providers under @pulumi/providers team have ad-hoc workflow names and do not want to
    // manage branch protections in this stack. This list might grow as needed.
    return !provider.includes("azure-native");
}

const providers = [...tfProviders, ...nativeProviders].filter(hasManagedBranchProtection);

function hasManagedBranchProtection(provider: string): boolean {
    // Some, but not all of the providers under @pulumi/providers team have ad-hoc workflow names and do not want to
    // manage branch protections in this stack. This list might grow as needed.
    return !provider.includes("azure-native");
}

for (let provider of providers) {
    const contexts: string[] = [
        "Update Changelog",

        // Undoing #310 for a bit so we can get retainOnDelete rolled out.
        //
        // "prerequisites",
        // "lint",
        // "lint-sdk",
        // "build_sdk (dotnet)",
        // "build_sdk (go)",
        // "build_sdk (java)",
        // "build_sdk (nodejs)",
        // "build_sdk (python)",
        // "test (dotnet)",
        // "test (go)",
        // "test (java)",
        // "test (nodejs)",
        // "test (python)",

        "sentinel",
    ];

    // enable branchProtection
    const branches: string[] = [
        "master",
        "main"
    ]
    for (let branch of branches) {
        new github.BranchProtection(`${provider}-${branch}-branchprotection`, {
            repositoryId: `pulumi-${provider}`,
            pattern: `${branch}`,
            requiredStatusChecks: [{
                strict: false,
                contexts: contexts,
            }]
        }, {
            // Prepare for no-op delete of azure-native and similar.
            retainOnDelete: !hasManagedBranchProtection(provider),
        })
    }
}
