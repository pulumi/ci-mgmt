PACK := aws
ORG := pulumi
PROJECT := github.com/pulumi/pulumi-aws
NODE_MODULE_NAME := @pulumi/aws
TF_NAME := aws
PROVIDER_PATH := provider/v5
SDK_PATH := sdk/v5
VERSION_PATH := provider/v5/pkg/version.Version
TFGEN := pulumi-tfgen-aws
PROVIDER := pulumi-resource-aws
VERSION := $(shell pulumictl get version)
TESTPARALLELISM := 10
WORKING_DIR := $(shell pwd)

development:: install_plugins

build:: install_plugins provider build_sdks install_sdks

only_build:: build

tfgen:: install_plugins
	(cd provider && go build -o $(WORKING_DIR)/bin/${TFGEN} -ldflags "-X ${PROJECT}/${VERSION_PATH}=${VERSION}" ${PROJECT}/${PROVIDER_PATH}/cmd/${TFGEN})
	$(WORKING_DIR)/bin/pulumi-tfgen-aws schema --out provider/cmd/pulumi-resource-aws
	(cd provider && VERSION=$(VERSION) go generate cmd/pulumi-resource-aws/main.go)

provider:: tfgen install_plugins
	(cd provider && go build -o $(WORKING_DIR)/bin/${PROVIDER} -ldflags "-X ${PROJECT}/${VERSION_PATH}=${VERSION} -X github.com/terraform-providers/terraform-provider-aws/version.ProviderVersion=${VERSION}" ${PROJECT}/${PROVIDER_PATH}/cmd/${PROVIDER})

build_sdks:: build_nodejs build_python build_go build_dotnet

build_nodejs:: VERSION := $(shell pulumictl get version --language javascript)
build_nodejs:: 
	$(WORKING_DIR)/bin/$(TFGEN) nodejs --overlays provider/overlays/nodejs --out sdk/nodejs/
	cd sdk/nodejs/ && \
		echo "module fake_nodejs_module // Exclude this directory from Go tools\n\ngo 1.16" > go.mod && \
		yarn install && \
		yarn run tsc && \
		cp ../../README.md ../../LICENSE package.json yarn.lock ./bin/ && \
		sed -i.bak -e "s/$${VERSION}/$(VERSION)/g" ./bin/package.json

build_python:: 

build_go:: 

build_dotnet:: 

lint_provider:: provider

cleanup:: 

help:: 

clean:: 

install_plugins:: 
	[ -x $(shell which pulumi) ] || curl -fsSL https://get.pulumi.com | sh
	pulumi plugin install resource tls 4.1.0
	pulumi plugin install resource github 4.10.0
	pulumi plugin install resource kubernetes 3.17.0
	pulumi plugin install resource random 4.4.1

install_dotnet_sdk:: 

install_python_sdk:: 

install_go_sdk:: 

install_nodejs_sdk:: 

install_sdks:: install_dotnet_sdk install_python_sdk install_nodejs_sdk

test:: 