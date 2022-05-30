PACK := aws
ORG := pulumi
PROJECT := github.com/pulumi/pulumi-aws
NODE_MODULE_NAME := @pulumi/aws
TF_NAME := aws
PROVIDER_PATH := provider/v5
SDK_PATH := sdk/v5
VERSION_PATH := provider/v5/pkg/version.Version
TF_GEN := pulumi-tfgen-aws
PROVIDER := pulumi-resource-aws
VERSION := $(shell pulumictl get version)
TESTPARALLELISM := 10
WORKING_DIR := $(shell pwd)

development:: install_plugins

build:: install_plugins provider build_sdks install_sdks

only_build:: build

tfgen:: install_plugins

provider:: tfgen install_plugins

build_sdks:: build_nodejs build_python build_go build_dotnet

build_nodejs:: 

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