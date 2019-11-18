architect-cli
=============

Command-line interface for Architect.io

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/architect-cli.svg)](https://npmjs.org/package/architect-cli)
[![CircleCI](https://circleci.com/gh/architect-team/architect-cli/tree/master.svg?style=shield)](https://circleci.com/gh/architect-team/architect-cli/tree/master)
[![Downloads/week](https://img.shields.io/npm/dw/architect-cli.svg)](https://npmjs.org/package/architect-cli)
[![License](https://img.shields.io/npm/l/architect-cli.svg)](https://github.com/architect-team/architect-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g architect-cli
$ architect COMMAND
running command...
$ architect (-v|--version|version)
architect-cli/0.3.3 darwin-x64 node-v11.15.0
$ architect --help [COMMAND]
USAGE
  $ architect COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`architect build`](#architect-build)
* [`architect config:get OPTION`](#architect-configget-option)
* [`architect config:set OPTION VALUE`](#architect-configset-option-value)
* [`architect config:view`](#architect-configview)
* [`architect deploy`](#architect-deploy)
* [`architect environments [QUERY]`](#architect-environments-query)
* [`architect environments:create [NAME]`](#architect-environmentscreate-name)
* [`architect environments:destroy NAME`](#architect-environmentsdestroy-name)
* [`architect help [COMMAND]`](#architect-help-command)
* [`architect init [NAME]`](#architect-init-name)
* [`architect install [SERVICE_NAME]`](#architect-install-service_name)
* [`architect login`](#architect-login)
* [`architect logout`](#architect-logout)
* [`architect services [QUERY]`](#architect-services-query)
* [`architect uninstall DEPENDENCY_NAME`](#architect-uninstall-dependency_name)

## `architect build`

Build an Architect-ready Docker image for a service

```
USAGE
  $ architect build

OPTIONS
  -h, --help             show CLI help
  -r, --recursive        Build this image as well as images for all its dependencies
  -s, --service=service  Path to a service to build
  -t, --tag=tag          [default: latest] Tag to give to the new Docker image(s)
```

_See code: [src/commands/build.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/build.ts)_

## `architect config:get OPTION`

Get the value of a CLI config option

```
USAGE
  $ architect config:get OPTION

ARGUMENTS
  OPTION  Name of a config option

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/config/get.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/config/get.ts)_

## `architect config:set OPTION VALUE`

Set a new value for a CLI configuration option

```
USAGE
  $ architect config:set OPTION VALUE

ARGUMENTS
  OPTION  Name of a config option
  VALUE   New value to assign to a config option

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/config/set.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/config/set.ts)_

## `architect config:view`

View all the CLI configuration settings

```
USAGE
  $ architect config:view

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect config
```

_See code: [src/commands/config/view.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/config/view.ts)_

## `architect deploy`

Create a deploy job on Architect Cloud or run stacks locally

```
USAGE
  $ architect deploy

OPTIONS
  -c, --config=config              Path to an environment config file for the environment
  -h, --help                       show CLI help
  -l, --local                      Deploy the stack locally instead of via Architect Cloud

  -o, --compose_file=compose_file  [default:
                                   /var/folders/7q/hbx8m39d6sx_97r00bmwyd9w0000gn/T/architect-deployment-1574110894662.j
                                   son] Path where the compose file should be written to

  -s, --services=services          Paths to services to deploy
```

_See code: [src/commands/deploy.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/deploy.ts)_

## `architect environments [QUERY]`

List environments you have access to

```
USAGE
  $ architect environments [QUERY]

ARGUMENTS
  QUERY  Search term used to filter the results

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect environments
  $ architect envs
  $ architect env
  $ architect environments:list
  $ architect envs:list
  $ architect env:list
```

_See code: [src/commands/environments/index.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/environments/index.ts)_

## `architect environments:create [NAME]`

Register a new environment with Architect Cloud

```
USAGE
  $ architect environments:create [NAME]

ARGUMENTS
  NAME  Name to give the environment

OPTIONS
  -c, --config_file=config_file
  -h, --help                                       show CLI help
  -h, --host=host
  -k, --kubeconfig=kubeconfig                      [default: ~/.kube/config]
  -n, --namespace=namespace
  -t, --type=kubernetes                            [default: kubernetes]
  --cluster_ca_certificate=cluster_ca_certificate  File path of cluster_ca_certificate
  --service_token=service_token                    Service token

ALIASES
  $ architect environment:create
  $ architect envs:create
  $ architect env:create
```

_See code: [src/commands/environments/create.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/environments/create.ts)_

## `architect environments:destroy NAME`

Destroy an environment

```
USAGE
  $ architect environments:destroy NAME

ARGUMENTS
  NAME  Name of the environment to destroy

OPTIONS
  -a, --auto_approve  Automatically apply the changes without reviewing the diff
  -f, --force         Force the deletion even if the environment is not empty
  -h, --help          show CLI help

ALIASES
  $ architect environment:destroy
  $ architect envs:destroy
  $ architect env:destroy
```

_See code: [src/commands/environments/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/environments/destroy.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.1/src/commands/help.ts)_

## `architect init [NAME]`

Generate an Architect service configuration file

```
USAGE
  $ architect init [NAME]

OPTIONS
  -d, --description=description  Written description of the service and its function
  -h, --help                     show CLI help
  -k, --keywords=keywords        Comma-separated list of keywords used to discover the service
  -l, --language=language        The language the service is written in
  -o, --output=output            Directory to write config file to

EXAMPLE
  $ architect hello
  ? name: architect/test-service
  ? description: Test service
  ? keywords (comma-separated): test,microservice
  ? author: architect
```

_See code: [src/commands/init.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/init.ts)_

## `architect install [SERVICE_NAME]`

Install services and their generate the corresponding client libraries

```
USAGE
  $ architect install [SERVICE_NAME]

ARGUMENTS
  SERVICE_NAME  Name of or path to the service to install

OPTIONS
  -h, --help             show CLI help
  -r, --recursive        Recursively generates required client code for downstream dependencies
  -s, --service=service  Path to services to generate client code for
```

_See code: [src/commands/install.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/install.ts)_

## `architect login`

Login to the Architect Cloud platform

```
USAGE
  $ architect login

OPTIONS
  -h, --help               show CLI help
  -p, --password=password  Password
  -u, --username=username  Username
```

_See code: [src/commands/login.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/login.ts)_

## `architect logout`

Logout from the Architect registry

```
USAGE
  $ architect logout

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/logout.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/logout.ts)_

## `architect services [QUERY]`

Search for services on Architect Cloud

```
USAGE
  $ architect services [QUERY]

ARGUMENTS
  QUERY  Search query used to filter results

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect services
  $ architect services:search
```

_See code: [src/commands/services/index.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/services/index.ts)_

## `architect uninstall DEPENDENCY_NAME`

Uninstall a dependency from the current service

```
USAGE
  $ architect uninstall DEPENDENCY_NAME

ARGUMENTS
  DEPENDENCY_NAME  Name of the dependency to remove

OPTIONS
  -h, --help             show CLI help
  -s, --service=service  Path to service root
```

_See code: [src/commands/uninstall.ts](https://github.com/architect-team/architect-cli/blob/v0.3.3/src/commands/uninstall.ts)_
<!-- commandsstop -->
