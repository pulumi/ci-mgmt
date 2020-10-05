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
