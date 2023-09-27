NAME ?= all
PROVIDERS := $(patsubst %/, %, $(wildcard providers/*/))
PROVIDER_REPOS := $(addsuffix /repo, $(PROVIDERS))

# These targets are versioned to cause Make to rebuild them when the version changes.
ACTIONLINT_VERSION := 1.6.24
ACTIONLINT := bin/actionlint-$(ACTIONLINT_VERSION)

all: ensure test format providers lint-providers

gen: clean providers

bin/provider-ci: $(shell find internal -type f)
	go build -o bin/provider-ci

$(ACTIONLINT):
	GOBIN=$(abspath bin) go install github.com/rhysd/actionlint/cmd/actionlint@v1.6.24
	mv bin/actionlint $(ACTIONLINT)

ensure:: bin/provider-ci

clean:
	rm -rf providers/*/repo
	rm -rf platform/examples/repo
	rm -rf bin

test:
	golangci-lint run

format:
	go fmt ./...

providers/%/repo: bin/provider-ci providers/%/config.yaml
	@./bin/provider-ci generate \
		--name pulumi/pulumi-$* \
		--out ./providers/$*/repo \
		--template bridged-provider \
		--config ./providers/$*/config.yaml
	@touch ./providers/$*/repo
	@echo "Generated providers/$*/repo"

lint-providers/%/repo: $(ACTIONLINT) providers/%/repo
	@echo Linting $*
	# Running actionlint in the context of a temporary .git repo so under
	# providers/pulumi-xyz/repo so that it checks
	# providers/pulumi-xyz/repo/.github/workflows/*.yml and correctly identifies their
	# cross-references; there does not seem to be a direct way to do it. Without the temp .git
	# directory it either starts checking ci-mgmt workflows itself or checks workflows
	# file-by-file and incorrectly reports dangling cross-references.
	cd providers/$*/repo &&	git init && ../../../$(ACTIONLINT) -config-file ../../../actionlint.yml && rm -rf .git
	@scripts/shellcheck.sh providers/$*/repo

LINT_RULES := $(addprefix lint-, $(PROVIDER_REPOS))
lint-providers: $(LINT_RULES)

providers: $(PROVIDER_REPOS)
ifeq ($(NAME), all)
provider: providers
else
provider: providers/$(NAME)/repo
endif

.PHONY: all gen ensure clean test format provider providers lint-providers
