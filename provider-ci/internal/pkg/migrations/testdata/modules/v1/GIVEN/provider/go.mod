module github.com/pulumi/pulumi-foo/provider

go 1.22.7

require github.com/terraform-providers/terraform-provider-foo/shim v0.0.0

replace github.com/terraform-providers/terraform-provider-foo/shim => ./shim
