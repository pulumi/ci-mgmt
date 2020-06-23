#!/bin/bash

set -x

WORKDIR=$(pwd)
TMPDIR=$(mktemp -d)
BRANCH_NAME=$1
COMMIT_MSG=$2

if [[ -z  ${BRANCH_NAME} ]];
then
    echo "Must specify branch name"
    exit 1
fi

if [[ -z  ${COMMIT_MSG} ]];
then
    echo "Must specify commit message"
    exit 1
fi

for provider in $( ls ${WORKDIR}/providers ); do

    PROVIDER_CONFIG_PATH=${WORKDIR}/providers/${provider}/repo/

    echo "Processing provider" ${provider}
    echo "Cloning new provider copy to ${TMPDIR}/pulumi-${provider}"
    hub clone pulumi/pulumi-${provider} ${TMPDIR}/pulumi-${provider}

    echo "copying files..."
    rsync -avzP ${PROVIDER_CONFIG_PATH} ${TMPDIR}/pulumi-${provider}/

    echo "Adding & committing changes"
    hub branch "${BRANCH_NAME}"
    hub add -A
    hub commit -m "${COMMIT_MSG}"
    hub push origin "${BRANCH_NAME}"
    hub pull-request --labels "impact/no-changelog-required" -a "stack72,jaxxstorm"
done

