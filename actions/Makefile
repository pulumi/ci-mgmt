.PHONY: dist clean gen test

all: dist

dist:
	npx tsc

%: 
	rm -rvf tf-providers/$@/repo
	jk generate generate-tf-provider.ts -f tf-providers/$@/config.yaml

tf-providers := $(shell ls tf-providers)

define tf-provider-target
tf-providers:: dist
	@tput setaf 6
	@echo "GENERATING TF PROVIDER $1"
	@tput sgr0
	rm -rf tf-providers/$1/repo && jk generate generate-tf-provider.ts -f tf-providers/$1/config.yaml
endef

$(foreach dir,$(tf-providers),$(eval $(call tf-provider-target,$(dir))))

deploy: tf-providers
	echo "hi"

clean:
	rm -rf tf-providers/*/repo

# Generate the GitHub Actions for the examples repo
# It will generate the files to a platform directory and then examples directory
examples: dist
	rm -rvf platform/examples/repo
	jk generate generate-examples.ts
