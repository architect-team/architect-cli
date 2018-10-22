architect
=========

Command line interface for creating and deploying architect services

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/architect.svg)](https://npmjs.org/package/architect)
[![Downloads/week](https://img.shields.io/npm/dw/architect.svg)](https://npmjs.org/package/architect)
[![License](https://img.shields.io/npm/l/architect.svg)](https://github.com/snappi/architect-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g architect
$ architect COMMAND
running command...
$ architect (-v|--version|version)
architect/0.1.0 darwin-x64 node-v8.9.4
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

Display help for the architect CLI

```
USAGE
  $ architect help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.2/src/commands/help.ts)_

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

_See code: [src/commands/init.ts](https://github.com/snappi/architect-cli/blob/v0.1.0/src/commands/init.ts)_

## `architect install`

Install dependencies needed for the current service and generate their corresponding 
API stubs

```
USAGE
  $ architect install

OPTIONS
  -h, --help       show CLI help
  -r, --recursive  Generate architect dependency stubs for all services in the dependency tree.
```

_See code: [src/commands/install.ts](https://github.com/snappi/architect-cli/blob/v0.1.0/src/commands/install.ts)_

## `architect start`

Start the current service and if needed its corresponding dependencies. Each service 
will automatically be injected a client stub enriched with the location of the peers. 
Services that are already running can be specified in a provided config file.

```
USAGE
  $ architect start

OPTIONS
  -h, --help          show CLI help
  -c, --config_path   Path to a config file containing locations of each service in the application
```

_See code: [src/commands/start.ts](https://github.com/snappi/architect-cli/blob/v0.1.0/src/commands/start.ts)_
<!-- commandsstop -->
