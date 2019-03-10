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
@architect-io/cli/0.1.8 darwin-x64 node-v10.15.0
$ architect --help [COMMAND]
USAGE
  $ architect COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`architect help [COMMAND]`](#architect-help-command)
* [`architect init`](#architect-init)
* [`architect install`](#architect-install)
* [`architect start`](#architect-start)

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.3/src/commands/help.ts)_

## `architect init`

Create an architect.json file for a service

```
USAGE
  $ architect init

OPTIONS
  -a, --author=author
  -d, --description=description
  -h, --help                     show CLI help
  -k, --keywords=keywords
  -l, --license=license          [default: MIT]
  -n, --name=name                [default: architect-cli]
  -v, --version=version          [default: 0.1.0]
```

_See code: [src/commands/init.ts](https://github.com/architect-team/architect-cli/blob/v0.1.8/src/commands/init.ts)_

## `architect install`

Install dependencies of the current service

```
USAGE
  $ architect install

OPTIONS
  -h, --help           show CLI help
  -p, --prefix=prefix  Path prefix indicating where the install command should execute from.
  -r, --recursive      Generate architect dependency files for all services in the dependency tree.
```

_See code: [src/commands/install.ts](https://github.com/architect-team/architect-cli/blob/v0.1.8/src/commands/install.ts)_

## `architect start`

Start the service locally

```
USAGE
  $ architect start

OPTIONS
  -c, --config_path=config_path  Path to a config file containing locations of each service in the application
  -h, --help                     show CLI help
```

_See code: [src/commands/start.ts](https://github.com/architect-team/architect-cli/blob/v0.1.8/src/commands/start.ts)_
<!-- commandsstop -->

# Special Thanks
* [namely/docker-protoc](https://github.com/namely/docker-protoc) - excellent, compact container for generating GRPC clients for all languages
