NAME ?= all

.PHONY: all ensure clean providers examples

all: ensure clean providers

ensure:
	npm ci

clean:
	rm -rf providers/*/repo

ifneq ($(NAME),all)
provider:
	echo $(NAME)
	npm run gen-providers -- --name $(NAME) --debug
else 
providers:
	npm run gen-providers
endif

examples:
	npm run gen-examples
