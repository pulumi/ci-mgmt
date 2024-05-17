NAME ?= all

.PHONY: all ensure clean test format providers examples

all: ensure clean test format providers

ensure:
	npm i

clean:
	rm -rf providers/*/repo

test:	
	npm run lint

format:
	npm run format

ifneq ($(NAME),all)
provider:
	echo $(NAME)
	npm run gen-providers -- --name $(NAME) --debug
else 
providers:
	npm run gen-providers
endif

discovery:
	npm run discovery
	npm run format

lint:
	find providers -type f -name '*.yml' -not -name ".goreleaser.*" | xargs actionlint -ignore SC2086:info -ignore SC2129:style -ignore SC2046:warning -ignore "unexpected key" -ignore SC2044:warning -ignore "always evaluated to true" -ignore SC2088:
