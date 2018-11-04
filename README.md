architect
=========

Command line interface for creating and deploying architect services

[![License](https://img.shields.io/npm/l/architect.svg)](https://github.com/snappi/architect-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
* [Demo](#demo)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @snappi/architect
$ architect COMMAND
running command...
$ architect (-v|--version|version)
@snappi/architect/0.0.5 darwin-x64 node-v9.11.2
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

_See code: [src/commands/init.ts](https://github.com/snappi/architect-cli/blob/v0.0.5/src/commands/init.ts)_

## `architect install`

Install dependencies of the current service

```
USAGE
  $ architect install

OPTIONS
  -h, --help       show CLI help
  -r, --recursive  Generate architect dependency files for all services in the dependency tree.
```

_See code: [src/commands/install.ts](https://github.com/snappi/architect-cli/blob/v0.0.5/src/commands/install.ts)_

## `architect start`

Start the service locally

```
USAGE
  $ architect start

OPTIONS
  -c, --config_path=config_path  Path to a config file containing locations of each service in the application
  -h, --help                     show CLI help
```

_See code: [src/commands/start.ts](https://github.com/snappi/architect-cli/blob/v0.0.5/src/commands/start.ts)_
<!-- commandsstop -->

# Demo

* [Install GRPC and Protoc](https://github.com/grpc/grpc/blob/master/BUILDING.md#pre-requisites)
* [Make sure you have node JS installed](https://nodejs.org/en/download/package-manager/)
* The demo includes javascript services, which means we'll need the node plugins for grpc and protobuf
```
$ npm install -g yarn
$ yarn global add grpc
$ yarn global add google-protobuf
```

* Install architect via yarn
```
$ yarn global add @snappi/architect
```

* Clone the demo project
```
$ git clone git@github.com:snappi/calculator-service-demo.git
$ cd calculator-service-demo/test-service
```

* Install the client stubs for the test script and its dependencies
```
$ architect install --recursive
```

* Start the test service
```
$ architect start
```

* Done!
