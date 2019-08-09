Architect CLI
=========

### [View Documentation](https://docs.architect.io/)

[![License](https://img.shields.io/circleci/project/github/architect-team/architect-cli.svg)](https://circleci.com/gh/architect-team/architect-cli/tree/master)
[![Version](https://img.shields.io/npm/v/@architect-io/cli.svg)](https://npmjs.org/package/@architect-io/cli)
[![License](https://img.shields.io/npm/l/@architect-io/cli.svg)](https://github.com/architect-team/architect-cli/blob/master/package.json)

Command line interface for creating and deploying architect services.

<!-- toc -->
* [Requirements](#requirements)
* [Usage](#usage)
* [Commands](#commands)
* [Special Thanks](#special-thanks)
<!-- tocstop -->

# Requirements
* Node >= v8.x

# Usage
<!-- usage -->
```sh-session
$ npm install -g @architect-io/cli
$ architect COMMAND
running command...
$ architect (-v|--version|version)
@architect-io/cli/0.2.1 darwin-x64 node-v10.15.0
$ architect --help [COMMAND]
USAGE
  $ architect COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`architect autocomplete [SHELL]`](#architect-autocomplete-shell)
* [`architect build [CONTEXT]`](#architect-build-context)
* [`architect commands`](#architect-commands)
* [`architect deploy [SERVICE]`](#architect-deploy-service)
* [`architect environments [ENVIRONMENT]`](#architect-environments-environment)
* [`architect environments:create [NAME]`](#architect-environmentscreate-name)
* [`architect environments:destroy [ENVIRONMENT]`](#architect-environmentsdestroy-environment)
* [`architect environments:services [ENVIRONMENT]`](#architect-environmentsservices-environment)
* [`architect environments:services:destroy [SERVICE]`](#architect-environmentsservicesdestroy-service)
* [`architect help [COMMAND]`](#architect-help-command)
* [`architect init [NAME]`](#architect-init-name)
* [`architect install [SERVICE_NAME]`](#architect-install-service_name)
* [`architect login`](#architect-login)
* [`architect logout`](#architect-logout)
* [`architect push [CONTEXT]`](#architect-push-context)
* [`architect services [SERVICE_NAME]`](#architect-services-service_name)
* [`architect uninstall SERVICE_NAME`](#architect-uninstall-service_name)

## `architect autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ architect autocomplete [SHELL]

ARGUMENTS
  SHELL  shell type

OPTIONS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

EXAMPLES
  $ architect autocomplete
  $ architect autocomplete bash
  $ architect autocomplete zsh
  $ architect autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v0.1.3/src/commands/autocomplete/index.ts)_

## `architect build [CONTEXT]`

Create an architect.json file for a service

```
USAGE
  $ architect build [CONTEXT]

ARGUMENTS
  CONTEXT  Path to the service to build

OPTIONS
  -h, --help       show CLI help
  -r, --recursive  Whether or not to build images for the cited dependencies
  -v, --verbose    Verbose log output
```

_See code: [src/commands/build.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/build.ts)_

## `architect commands`

list all the commands

```
USAGE
  $ architect commands

OPTIONS
  -h, --help  show CLI help
  -j, --json  output in json format
  --hidden    also show hidden commands
```

_See code: [@oclif/plugin-commands](https://github.com/oclif/plugin-commands/blob/v1.2.2/src/commands/commands.ts)_

## `architect deploy [SERVICE]`

Deploy service to environments

```
USAGE
  $ architect deploy [SERVICE]

ARGUMENTS
  SERVICE  Service name

OPTIONS
  -h, --help                     show CLI help
  -l, --local
  --config_file=config_file
  --deployment_id=deployment_id
  --environment=environment
```

_See code: [src/commands/deploy.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/deploy.ts)_

## `architect environments [ENVIRONMENT]`

List, create, or delete environments

```
USAGE
  $ architect environments [ENVIRONMENT]

ARGUMENTS
  ENVIRONMENT  Environment name

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect environments:list
  $ architect environment
  $ architect environment:list
```

_See code: [src/commands/environments/index.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/environments/index.ts)_

## `architect environments:create [NAME]`

Create or update environment

```
USAGE
  $ architect environments:create [NAME]

ARGUMENTS
  NAME  Environment name

OPTIONS
  -h, --help                                       show CLI help
  -v, --verbose                                    Verbose log output
  --cluster_ca_certificate=cluster_ca_certificate  File path of cluster_ca_certificate
  --host=host
  --namespace=namespace
  --service_token=service_token                    Service token
  --type=kubernetes                                [default: kubernetes]

ALIASES
  $ architect environment:create
  $ architect environment:update
  $ architect environments:update
```

_See code: [src/commands/environments/create.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/environments/create.ts)_

## `architect environments:destroy [ENVIRONMENT]`

Destroy environment

```
USAGE
  $ architect environments:destroy [ENVIRONMENT]

ARGUMENTS
  ENVIRONMENT  Environment name

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect environment:destroy
```

_See code: [src/commands/environments/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/environments/destroy.ts)_

## `architect environments:services [ENVIRONMENT]`

Search an environments services

```
USAGE
  $ architect environments:services [ENVIRONMENT]

ARGUMENTS
  ENVIRONMENT  Environment name

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect environments:services:list
  $ architect environments:services:versions
  $ architect environment:services
  $ architect environment:services:list
  $ architect environment:services:versions
```

_See code: [src/commands/environments/services/index.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/environments/services/index.ts)_

## `architect environments:services:destroy [SERVICE]`

Destroy service from an environment

```
USAGE
  $ architect environments:services:destroy [SERVICE]

ARGUMENTS
  SERVICE  Service name

OPTIONS
  -h, --help                         show CLI help
  -p, --deployment_id=deployment_id
  --environment=environment          Environment name

ALIASES
  $ architect environment:services:destroy
```

_See code: [src/commands/environments/services/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/environments/services/destroy.ts)_

## `architect help [COMMAND]`

display help for architect

```
USAGE
  $ architect help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.0/src/commands/help.ts)_

## `architect init [NAME]`

Create an architect.json file for a service

```
USAGE
  $ architect init [NAME]

OPTIONS
  -a, --author=author
  -d, --description=description
  -h, --help                     show CLI help
  -k, --keywords=keywords
  -l, --license=license          [default: MIT]
  -v, --version=version          [default: 0.1.0]
```

_See code: [src/commands/init.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/init.ts)_

## `architect install [SERVICE_NAME]`

Install dependencies of the current service

```
USAGE
  $ architect install [SERVICE_NAME]

ARGUMENTS
  SERVICE_NAME  Remote service dependency

OPTIONS
  -h, --help           show CLI help
  -p, --prefix=prefix  Path prefix indicating where the install command should execute from
  -r, --recursive      Generate architect dependency files for all services in the dependency tree
  -v, --verbose        Verbose log output
```

_See code: [src/commands/install.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/install.ts)_

## `architect login`

Log in to a Architect registry

```
USAGE
  $ architect login

OPTIONS
  -h, --help               show CLI help
  -p, --password=password  Password
  -u, --username=username  Username
```

_See code: [src/commands/login.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/login.ts)_

## `architect logout`

Logout of the Architect registry

```
USAGE
  $ architect logout

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/logout.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/logout.ts)_

## `architect push [CONTEXT]`

Push service(s) to a registry

```
USAGE
  $ architect push [CONTEXT]

ARGUMENTS
  CONTEXT  Path to the service to build

OPTIONS
  -h, --help     show CLI help
  -v, --verbose  Verbose log output
```

_See code: [src/commands/push.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/push.ts)_

## `architect services [SERVICE_NAME]`

Search services

```
USAGE
  $ architect services [SERVICE_NAME]

ARGUMENTS
  SERVICE_NAME  Service name

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect services:list
  $ architect services:versions
```

_See code: [src/commands/services/index.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/services/index.ts)_

## `architect uninstall SERVICE_NAME`

Uninstall dependencies of the current service

```
USAGE
  $ architect uninstall SERVICE_NAME

OPTIONS
  -h, --help           show CLI help
  -p, --prefix=prefix  Path prefix indicating where the install command should execute from
```

_See code: [src/commands/uninstall.ts](https://github.com/architect-team/architect-cli/blob/v0.2.1/src/commands/uninstall.ts)_
<!-- commandsstop -->

# Special Thanks
* [namely/docker-protoc](https://github.com/namely/docker-protoc) - excellent, compact container for generating GRPC clients for all languages
