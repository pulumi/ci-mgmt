# Install Pulumi and plugins required at build time.
install_plugins: .make/install_plugins
.make/install_plugins: export PULUMI_HOME := $(WORKING_DIR)/.pulumi
.make/install_plugins:
	#{{- range .Config.Plugins }}#
	pulumi plugin install #{{ or .Kind "resource" }}# #{{ .Name }}# #{{ .Version }}#
	#{{- end }}#
	@touch $@
.PHONY: install_plugins
