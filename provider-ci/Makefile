NAME ?= all

all: ensure clean providers examples

gen: clean providers examples

node_modules:: package.json yarn.lock
	yarn install
	@touch node_modules

ensure:: node_modules

clean:
	rm -rf providers/*/repo
	rm -rf platform/examples/repo

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

.PHONY: all ensure clean providers examples providers/ec/repo
