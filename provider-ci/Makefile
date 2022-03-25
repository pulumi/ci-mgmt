.PHONY: all ensure clean test format providers examples discovery

all: ensure clean test format providers examples

ensure:
	npm i

clean:
	rm -rf providers/*/repo
	rm -rf platform/examples/repo

test:	
	npm run lint

format:
	npm run format

providers:
	npm run gen-providers

# Generate the GitHub Actions for the examples repo
# It will generate the files to a platform directory and then examples directory
examples:
	npm run gen-examples

discovery:
	npm run discovery
	npm run format
