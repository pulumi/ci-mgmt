NAME ?= all

all: ensure clean test format providers examples

gen: clean providers examples

node_modules:: package.json yarn.lock
	yarn install
	@touch node_modules

ensure:: node_modules

clean:
	rm -rf providers/*/repo
	rm -rf platform/examples/repo

test:	
	yarn run lint

format:
	yarn run format

ifneq ($(NAME),all)
provider:: node_modules
	echo $(NAME)
	yarn run gen-providers -- --name $(NAME) --debug
else 
providers:: node_modules
	yarn run gen-providers
endif

# Generate the GitHub Actions for the examples repo
# It will generate the files to a platform directory and then examples directory
examples:: node_modules
	yarn run gen-examples

discovery:: node_modules
	yarn run discovery
	yarn run format

.PHONY: all ensure clean test format providers examples discovery providers/ec/repo
