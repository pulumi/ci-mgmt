module github.com/pulumi/pulumi-foo/examples/v6

go 1.22.7

replace (
	github.com/pulumi/pulumi-foo/provider/v6 => ../provider
	github.com/terraform-providers/terraform-provider-foo/shim => ../provider/shim
)

require github.com/pulumi/pulumi-foo/provider/v6 v6.0.0-20230306191832-8c7659ab0229

require github.com/terraform-providers/terraform-provider-foo/shim v0.0.0 // indirect
