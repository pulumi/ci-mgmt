# Reviewing resources.go Changes

The `provider/resources.go` file defines how Terraform resources and data sources map to Pulumi resources. This is the core configuration of the bridged provider.

## Key Areas to Review

### Resource Mappings

```go
prov.Resources = map[string]*tfbridge.ResourceInfo{
    "aws_instance": {
        Tok: awsResource(ec2Mod, "Instance"),
        // ...
    },
}
```

Review for:
- **Correct module placement** - Is the resource in the right Pulumi module?
- **Token naming** - Does the Pulumi name follow conventions?

### Field Overrides

```go
Fields: map[string]*tfbridge.SchemaInfo{
    "field_name": {
        Name: "fieldName",  // Rename for Pulumi
        Type: "string",     // Override type
    },
}
```

Review for:
- **Naming conventions** - Does the override improve the Pulumi API?
- **Type correctness** - Is the type override accurate?
- **Breaking changes** - Will this rename break existing users?

### Data Source Mappings

```go
prov.DataSources = map[string]*tfbridge.DataSourceInfo{
    "aws_ami": {
        Tok: awsDataSource(ec2Mod, "getAmi"),
    },
}
```

Review for:
- **Function naming** - Data sources should use `get*` prefix
- **Module placement** - Consistent with related resources

## Common Issues

2. **Incorrect module assignment** - Resource in wrong Pulumi module
3. **Breaking renames** - Changing `Tok` or field `Name` without migration

## Breaking Changes

These changes are breaking and require careful consideration:
- Changing a resource's `Tok`
- Changing a field's `Name`
- Removing a resource or field

If breaking changes are necessary, ensure:
- Proper deprecation warnings are in place
- Migration documentation is provided
- Major version bump is planned
