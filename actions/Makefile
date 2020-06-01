.PHONY: dist clean gen test

all: dist

dist:
	npx tsc

%: 
	rm -rvf providers/$@/*.yml
	jk generate generate.ts -f providers/$@/config.yaml

providers := $(shell ls providers)

define provider-target
providers::
	@tput setaf 6
	@echo "GENERATING PROVIDER $1"
	@tput sgr0
	rm -rf providers/$1/repo && jk generate generate.ts -f providers/$1/config.yaml
endef

$(foreach dir,$(providers),$(eval $(call provider-target,$(dir))))

clean:
	rm -rf providers/*/repo
