# Used by Renovate to re-generate workflows.
build:
	make -C provider-ci gen
	make -C native-provider-ci providers
