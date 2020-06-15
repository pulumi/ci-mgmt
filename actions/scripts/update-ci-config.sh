#!/usr/bin/env bash

set -o errexit
set -o pipefail

set -x

CHANGELOG_ENTRY=
while getopts ":m:" arg; do
  case "${arg}" in
    m)
      CHANGELOG_ENTRY=$OPTARG
      ;;
  esac
done

BRANCH_NAME=$1
COMMIT_MESSAGE=$2

if [ -z "${BRANCH_NAME}" ] ; then
    echo "Must specify a branch name"
    exit 1
fi

if [ -z "${COMMIT_MESSAGE}" ] ; then
    echo "Must specify a commit message"
    exit 1
fi

clone_repo_if_not_exists() {
	local repoPath=$1
	local repoName=$2

	if [ ! -d "${repoPath}" ] ; then
		git clone "git@github.com:pulumi/${repoName}" ${repoPath}
	fi
}

make_clean_worktree() {
	local repoPath=$1
	local branchName=$2

	dirtyStatus="$(cd "${repoPath}" && git status -s)"

	bash  <<-EOF
	echo "${dirtyStatus}"

	cd "${repoPath}"
	if [ -n "${dirtyStatus}" ] ; then
		git add .
		git stash save --all "Stash changes before updating provider"
	fi

	git checkout master
	git pull origin master
	git checkout "${branchName}" || git checkout -b "${branchName}"
	EOF
}

copy_ci_files() {
    local repoPath=$1
    local providerName=$2

    echo "Copying files from providers/${providerName}/repo/ to ${repoPath}"
    rsync -avzP providers/${providerName}/repo/ ${repoPath}
}

commit_changes() {
    local repoPath=$1
    local commitMessage=$2

    dirtyStatus="$(cd "${repoPath}" && git status -s)"

	bash <<-EOF
	    cd "${repoPath}"

	    if [ -n "${dirtyStatus}" ] ; then
	        git add -A
	        git commit -a -m "${commitMessage}"
	    fi
	EOF
}

push_and_pull_request() {
	local repoPath=$1
	local branchName=$2

	bash <<-EOF
	cd "${repoPath}"

	git push origin "${branchName}"

	pr=$(hub pr show -u -h "${branchName}")

	if [[ "$pr" == *"no open pull requests"* ]];
    then
         hub pull-request \
		    --base master \
		    --head "${branchName}" \
		    --message "Update ci config" \
		    --labels "area/providers" \
		    --labels "impact/no-changelog-required" \
		    -a "jaxxstorm,stack72
    else
	   echo "pr already exists"
	fi
	EOF
}

PROVIDERS=$(ls providers)

for PROVIDER_SUFFIX in ${PROVIDERS}
do
	PROVIDER_REPO="pulumi-${PROVIDER_SUFFIX}"
	PROVIDER_REPO_PATH="$(go env GOPATH)/src/github.com/pulumi/${PROVIDER_REPO}"

	echo "Updating ci config in ${PROVIDER_REPO}..."
	clone_repo_if_not_exists "${PROVIDER_REPO_PATH}" "${PROVIDER_REPO}"
	make_clean_worktree "${PROVIDER_REPO_PATH}" "${BRANCH_NAME}"
	copy_ci_files "${PROVIDER_REPO_PATH}" "${PROVIDER_SUFFIX}"
	commit_changes "${PROVIDER_REPO_PATH}" "${COMMIT_MESSAGE}"
	push_and_pull_request "${PROVIDER_REPO_PATH}" "${BRANCH_NAME}"
done
