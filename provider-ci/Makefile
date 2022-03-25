.PHONY: dist clean gen test

all: clean
	npm run gen-providers

%: 
	rm -rvf providers/$@/repo
	npm run gen-providers -n $@

providers := $(shell ls providers)

define provider-target
providers:: dist
	@tput setaf 6
	@echo "GENERATING TF PROVIDER $1"
	@tput sgr0
	rm -rf providers/$1/repo && jk generate generate-provider.ts -f providers/$1/config.yaml
endef

$(foreach dir,$(providers),$(eval $(call provider-target,$(dir))))

deploy: providers
	echo "hi"

clean:
	rm -rf providers/*/repo

# Generate the GitHub Actions for the examples repo
# It will generate the files to a platform directory and then examples directory
examples: dist
	rm -rvf platform/examples/repo
	npm run gen-examples
