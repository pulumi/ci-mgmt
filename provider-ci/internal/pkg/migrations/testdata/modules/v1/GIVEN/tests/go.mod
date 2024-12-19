module github.com/pulumi/pulumi-foo/tests

go 1.22.7

replace (
	github.com/pulumi/pulumi-foo/provider => ../provider
	github.com/terraform-providers/terraform-provider-foo/shim => ../provider/shim
)

require github.com/pulumi/pulumi-foo/provider v0.0.0-00010101000000-000000000000

require github.com/terraform-providers/terraform-provider-foo/shim v0.0.0 // indirect
