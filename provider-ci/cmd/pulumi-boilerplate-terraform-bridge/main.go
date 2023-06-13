// Copyright 2016-2023, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg"
	"github.com/pulumi/ci-mgmt/provider-ci/internal/pkg/logging"
	"github.com/pulumi/pulumi/sdk/v3/go/common/resource/plugin"
	"github.com/pulumi/pulumi/sdk/v3/go/common/util/rpcutil"
	pulumirpc "github.com/pulumi/pulumi/sdk/v3/proto/go"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type bridgeBoilerplate struct{}

func (*bridgeBoilerplate) Close() error {
	return nil
}

func (*bridgeBoilerplate) CreatePackage(ctx context.Context,
	req *plugin.CreatePackageRequest,
) (*plugin.CreatePackageResponse, error) {
	logger := logging.NewDefaultLogger()
	logging.SetVerbosity(logger, 10)
	ctx = logging.ContextWithLogger(ctx, logger)

	name := req.Name
	logger.Debug("CreatePackage called", "name", name)

	err := pkg.GeneratePackage(ctx, pkg.GenerateOpts{
		Name:           name,
		Config:         req.Config,
		OutDir:         fmt.Sprintf("pulumi-%s", name),
		ExecuteScripts: true,
		TemplateName:   "bridged-boilerplate",
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate package: %v", err)
	}

	return &plugin.CreatePackageResponse{}, nil
}

func main() {
	// Fire up a gRPC server, letting the kernel choose a free port for us.
	handle, err := rpcutil.ServeWithOptions(rpcutil.ServeOptions{
		Init: func(srv *grpc.Server) error {
			pulumirpc.RegisterBoilerplateServer(srv, plugin.NewBoilerplateServer(&bridgeBoilerplate{}))
			return nil
		},
		Options: rpcutil.OpenTracingServerInterceptorOptions(nil),
	})
	if err != nil {
		log.Fatalf("fatal: %v", err)
	}

	// The boilerplate protocol requires that we now write out the port we have chosen to listen on.
	fmt.Printf("%d\n", handle.Port)

	// Finally, wait for the server to stop serving.
	if err := <-handle.Done; err != nil {
		log.Fatalf("fatal: %v", err)
	}
}
