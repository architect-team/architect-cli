<!-- docs -->

<p align="center">
  <a href="//architect.io" target="blank"><img src="https://docs.architect.io/img/logo.svg" width="480" alt="Architect Logo" /></a>
</p>

<p align="center">
  <a href="https://oclif.io"><img src="https://img.shields.io/badge/cli-oclif-brightgreen.svg" alt="oclif" /></a>
  <a href="https://github.com/architect-team/architect-cli/actions?query=workflow%3A%22CLI+-+Cut+Release+Candidate%22"><img src="https://img.shields.io/github/workflow/status/architect-team/architect-cli/CLI%20-%20Cut%20Release%20Candidate" alt="Build" /></a>
  <a href="https://npmjs.org/package/@architect-io/cli"><img src="https://img.shields.io/npm/v/@architect-io/cli.svg" alt="Version" /></a>
  <a href="https://github.com/architect-team/architect-cli/blob/master/package.json"><img src="https://img.shields.io/npm/l/@architect-io/cli.svg" alt="License" /></a>
</p>

<p align="center">
  Self-service cloud environments for everyone. Achieve deployment, networking, and security automation all at once with Architect.
</p>

---

Architect is the world's first [DevOps-as-a-Service](//architect.io/product) toolset designed to help democratize environment provisioning for engineers. With Architect, anyone can deploy any service, anywhere, for any reason with the push of a button.

Our unique approach to continuous delivery is powered by an embedded dependency resolver. By simply asserting your microservice dependenies, Architect is able to build a graph of your application and deploy the entire stack to your favorite cloud provider.

Architect's CLI, which provides the full developer experience needed to create [components](//docs.architect.io) and operate local [environments](//docs.architect.io/deployments/local-environments), is fully open-source. The CLI can deploy components locally using docker-compose, enrich the deployments with components found in Architect's Cloud registry, and allows developers to publish their own components to the registry both publicly and privately for free.

## Requirements
* [**Docker**](//docs.docker.com/get-docker/) must be installed
* [**Node.js** `v12`](//nodejs.org/en/download/) or higher must be installed

## Usage

<!-- usage -->
```sh-session
$ npm install -g @architect-io/cli
$ architect COMMAND
running command...
$ architect (--version)
@architect-io/cli/1.16.0-arc-skypack.4 linux-x64 node-v16.15.1
$ architect --help [COMMAND]
USAGE
  $ architect COMMAND
...
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`architect autocomplete [SHELL]`](#architect-autocomplete-shell)
* [`architect help [COMMAND]`](#architect-help-command)

## `architect autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ architect autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  display autocomplete installation instructions

EXAMPLES
  $ architect autocomplete

  $ architect autocomplete bash

  $ architect autocomplete zsh

  $ architect autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v1.2.0/src/commands/autocomplete/index.ts)_

## `architect help [COMMAND]`

Display help for architect.

```
USAGE
  $ architect help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for architect.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.11/src/commands/help.ts)_
<!-- commandsstop -->
