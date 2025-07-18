NAME ?= all
PROVIDERS := $(patsubst %/, %, $(wildcard providers/*/))
PROVIDER_REPOS := $(addsuffix /repo, $(PROVIDERS))

# These targets are versioned to cause Make to rebuild them when the version changes.
ACTIONLINT_VERSION := 1.7.7
ACTIONLINT := bin/actionlint-$(ACTIONLINT_VERSION)

.PHONY: all test gen ensure
all: ensure test format lint
test: test-providers
gen: test-providers
ensure:: bin/provider-ci $(ACTIONLINT)

bin/provider-ci: $(shell find internal -type f)
	go build -o bin/provider-ci

$(ACTIONLINT):
	GOBIN=$(abspath bin) go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.7
	mv bin/actionlint $(ACTIONLINT)

# Basic helper targets.
.PHONY: clean lint format
clean:
	rm -rf bin

lint:
	golangci-lint run

format:
	go fmt ./...

# We check in a subset of provider workflows so template changes are visible in PR diffs.
#
# This provides an example of generated providers for PR reviewers. This target
# regenerates them. Only workflows generated by this target should be checked in. Workflow
# files for other bridged provider repositories should be ephemeral.
.PHONY: test-providers test-provider/%

test-providers: test-provider/aws test-provider/docker test-provider/cloudflare test-provider/acme test-provider/eks test-provider/terraform-module test-provider/command test-provider/aws-native test-provider/kubernetes-coredns test-provider/docker-build test-provider/kubernetes test-provider/kubernetes-cert-manager test-provider/kubernetes-ingress-nginx test-provider/xyz test-provider/pulumi-provider-boilerplate

# 1. Delete all files except the .ci-mgmt.yaml file and run the provider-ci generate command.
# 2. Copy the generated provider repository to a temporary git repo and run actionlint on it.
test-provider/%: PROVIDER_NAME = $*
test-provider/%: bin/provider-ci $(ACTIONLINT)
	cd test-providers/$(PROVIDER_NAME) && \
		find . -type f ! -name '.ci-mgmt.yaml' -delete && \
		../../bin/provider-ci generate --skip-migrations
	mkdir -p bin/test-provider
	rm -rf bin/test-provider/$(PROVIDER_NAME)
	cp -r test-providers/$(PROVIDER_NAME) bin/test-provider
	cd bin/test-provider/$(PROVIDER_NAME) && git init
	cd bin/test-provider/$(PROVIDER_NAME) && ../../../$(ACTIONLINT) -config-file ../../../../.github/actionlint.yaml
	# Experimental mise flag required to support building golang binaries (e.g. pulumictl)
	mise settings experimental=true
	cd bin/test-provider/$(PROVIDER_NAME) && mise trust && mise install && mise env

# Fetch the latest .ci-mgmt.yaml from the provider repositories ready for testing.
update-provider-configs:
	curl "https://raw.githubusercontent.com/pulumi/pulumi-aws/master/.ci-mgmt.yaml" > ./test-providers/aws/.ci-mgmt.yaml
	curl "https://raw.githubusercontent.com/pulumi/pulumi-cloudflare/master/.ci-mgmt.yaml" > ./test-providers/cloudflare/.ci-mgmt.yaml
	curl "https://raw.githubusercontent.com/pulumi/pulumi-docker/master/.ci-mgmt.yaml" > ./test-providers/docker/.ci-mgmt.yaml
