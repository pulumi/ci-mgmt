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
