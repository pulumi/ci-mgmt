NAME ?= all
PROVIDERS := $(patsubst %/, %, $(wildcard providers/*/))

all: ensure clean test format providers

gen: clean providers

# Go build caching is fast enough to use that instead of Make to avoid rebuilds.
bin/package-ci:
	go build -o bin/package-ci

ensure:: bin/package-ci

clean:
	rm -rf providers/*/repo
	rm -rf platform/examples/repo

test:
	golangci-lint run

format:
	go fmt ./...

providers/%/repo: bin/package-ci
	@echo Generating $*
	@./bin/package-ci generate \
		--name pulumi/pulumi-$* \
		--out ./providers/$*/repo \
		--template bridged-provider \
		--config ./providers/$*/config.yaml

providers: $(addsuffix /repo, $(PROVIDERS))
ifeq ($(NAME), all)
provider: providers
else
provider: provider/$(NAME)/repo
endif

.PHONY: all gen ensure clean test format provider providers provider/%/repo bin/package-ci
