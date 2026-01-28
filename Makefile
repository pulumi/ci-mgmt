# Used by Renovate to re-generate workflows.
build:
	make -C provider-ci gen

lint:
	make -C provider-ci lint
