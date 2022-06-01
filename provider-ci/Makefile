NAME ?= all

.PHONY: all ensure clean test format providers examples discovery

all: ensure clean test format providers examples

ensure:
	yarn install

clean:
	rm -rf providers/*/repo
	rm -rf platform/examples/repo

test:	
	yarn run lint

format:
	yarn run format

ifneq ($(NAME),all)
provider:
	echo $(NAME)
	yarn run gen-providers -- --name $(NAME) --debug
else 
providers:
	yarn run gen-providers
endif

# Generate the GitHub Actions for the examples repo
# It will generate the files to a platform directory and then examples directory
examples:
	yarn run gen-examples

discovery:
	yarn run discovery
	yarn run format
