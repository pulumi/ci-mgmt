# Used by Renovate to re-generate workflows.
build: sync-gh-aw-templates
	make -C provider-ci gen

lint:
	make -C provider-ci lint

sync-gh-aw-templates:
	./scripts/sync-gh-aw-templates.sh

check-gh-aw-templates:
	./scripts/sync-gh-aw-templates.sh --check
