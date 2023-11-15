package pkg

import "context"

type PostGenerateFunc func(ctx context.Context, opts GenerateOpts, config interface{}) error

var PostGenerateFns map[string][]PostGenerateFunc = map[string][]PostGenerateFunc{}
var TemplateDependencies map[string][]string = map[string][]string{}
var TemplateAliases map[string]string = map[string]string{}
