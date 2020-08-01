<!-- docs -->

<h1>Architect CLI</h1>

[![Version](https://img.shields.io/npm/v/@architect-io/cli.svg)](https://npmjs.org/package/@architect-io/cli)
[![Build](https://img.shields.io/github/workflow/status/architect-team/architect-cli/CLI%20-%20Cut%20Release%20Candidate)](https://github.com/architect-team/architect-cli/actions?query=workflow%3A%22CLI+-+Cut+Release+Candidate%22)
[![License](https://img.shields.io/npm/l/@architect-io/cli.svg)](https://github.com/architect-team/architect-cli/blob/master/package.json)
[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)

Command-line interface for [Architect.io](https://architect.io). This CLI can be used to:

1. Choreograph the deployment and networking of multiple [services](//architect.io/docs/getting-started/core-concepts#services) and
   [components](//architect.io/docs/getting-started/core-concepts#components) on your local machine
2. Aid in the creation and registration of [Architect components](//architect.io/docs/getting-started/core-concepts#components)
3. Issue deploy commands to Architect Cloud

# Usage

<!-- usage -->
```sh-session
$ npm install -g @architect-io/cli
$ architect COMMAND
running command...
$ architect (-v|--version|version)
@architect-io/cli/0.5.2-rc.13 linux-x64 node-v12.18.3
$ architect --help [COMMAND]
USAGE
  $ architect COMMAND
...
```
<!-- usagestop -->

_Note: the CLI uses the [keytar](http://atom.github.io/node-keytar/) library to store
your Architect Cloud credentials securely on your machine. If your OS doesn't support
keytar (like many linux systems) you will see an install error in the logs during NPM
install. Keytar is an optional dependency and the install will complete successfully
despite this error, but [you may hide it](https://github.com/nodejs/node-gyp/issues/1236)
by running npm install with the `--unsafe` flag._

# Commands

<!-- commands -->
* [`architect config:get OPTION`](#architect-configget-option)
* [`architect config:set OPTION VALUE`](#architect-configset-option-value)
* [`architect config:view`](#architect-configview)
* [`architect deploy [ENVIRONMENT_CONFIG]`](#architect-deploy-environment_config)
* [`architect environments [QUERY]`](#architect-environments-query)
* [`architect environments:clear`](#architect-environmentsclear)
* [`architect environments:destroy NAMESPACED_ENVIRONMENT`](#architect-environmentsdestroy-namespaced_environment)
* [`architect environments:update NAMESPACED_ENVIRONMENT`](#architect-environmentsupdate-namespaced_environment)
* [`architect help [COMMAND]`](#architect-help-command)
* [`architect link [SERVICEPATH]`](#architect-link-servicepath)
* [`architect login`](#architect-login)
* [`architect logout`](#architect-logout)
* [`architect platforms [QUERY]`](#architect-platforms-query)
* [`architect platforms:create [NAME]`](#architect-platformscreate-name)
* [`architect platforms:destroy NAMESPACED_PLATFORM`](#architect-platformsdestroy-namespaced_platform)
* [`architect register [COMPONENT]`](#architect-register-component)
* [`architect unlink [SERVICEPATHORNAME]`](#architect-unlink-servicepathorname)
* [`architect whoami`](#architect-whoami)

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

_See code: [src/commands/config/get.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/config/get.ts)_

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

_See code: [src/commands/config/set.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/config/set.ts)_

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

_See code: [src/commands/config/view.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/config/view.ts)_

## `architect deploy [ENVIRONMENT_CONFIG]`

Create a deploy job on Architect Cloud or run stacks locally

```
USAGE
  $ architect deploy [ENVIRONMENT_CONFIG]

ARGUMENTS
  ENVIRONMENT_CONFIG  Path to an environment config file

OPTIONS
  -d, --detached                   Run in detached mode
  -e, --environment=environment    Fully qualified environment name in the form my-account/environment-name
  -h, --help                       show CLI help
  -l, --local                      Deploy the stack locally instead of via Architect Cloud

  -o, --compose_file=compose_file  [default: /tmp/architect-deployment-1596250232406.json] Path where the compose file
                                   should be written to

  -p, --parameter=parameter        [default: ] Component parameters

  --auto_approve

  --platform=platform              Fully qualified platform name in the form my-account/platform-name
```

_See code: [src/commands/deploy.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/deploy.ts)_

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

_See code: [src/commands/environments/index.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/environments/index.ts)_

## `architect environments:clear`

Clear services from an environment

```
USAGE
  $ architect environments:clear

OPTIONS
  -d, --detached                   Run in detached mode
  -e, --environment=environment    Fully qualified environment name in the form my-account/environment-name
  -h, --help                       show CLI help
  -l, --local                      Deploy the stack locally instead of via Architect Cloud

  -o, --compose_file=compose_file  [default: /tmp/architect-deployment-1596250232406.json] Path where the compose file
                                   should be written to

  -p, --parameter=parameter        [default: ] Component parameters

  --auto_approve

  --platform=platform              Fully qualified platform name in the form my-account/platform-name

ALIASES
  $ architect environment:clear
  $ architect env:clear
```

_See code: [src/commands/environments/clear.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/environments/clear.ts)_

## `architect environments:destroy NAMESPACED_ENVIRONMENT`

Destroy an environment

```
USAGE
  $ architect environments:destroy NAMESPACED_ENVIRONMENT

ARGUMENTS
  NAMESPACED_ENVIRONMENT  Name of the environment to destroy

OPTIONS
  -a, --auto_approve  Automatically apply the changes without reviewing the diff
  -f, --force         Force the deletion even if the environment is not empty
  -h, --help          show CLI help

ALIASES
  $ architect environment:destroy
  $ architect envs:destroy
  $ architect env:destroy
```

_See code: [src/commands/environments/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/environments/destroy.ts)_

## `architect environments:update NAMESPACED_ENVIRONMENT`

Update an environments configuration

```
USAGE
  $ architect environments:update NAMESPACED_ENVIRONMENT

ARGUMENTS
  NAMESPACED_ENVIRONMENT  Name of the environment to update

OPTIONS
  -d, --description=description
  -h, --help                     show CLI help

ALIASES
  $ architect environment:update
  $ architect envs:update
  $ architect env:update
```

_See code: [src/commands/environments/update.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/environments/update.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.1.0/src/commands/help.ts)_

## `architect link [SERVICEPATH]`

Link a local service to the host to be used to power local deployments.

```
USAGE
  $ architect link [SERVICEPATH]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/link.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/link.ts)_

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

_See code: [src/commands/login.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/login.ts)_

## `architect logout`

Logout from the Architect registry

```
USAGE
  $ architect logout

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/logout.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/logout.ts)_

## `architect platforms [QUERY]`

Search for platforms on Architect Cloud

```
USAGE
  $ architect platforms [QUERY]

ARGUMENTS
  QUERY  Search query used to filter results

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect platform
  $ architect platform:search
  $ architect platforms
  $ architect platforms:search
```

_See code: [src/commands/platforms/index.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/platforms/index.ts)_

## `architect platforms:create [NAME]`

Register a new platform with Architect Cloud

```
USAGE
  $ architect platforms:create [NAME]

ARGUMENTS
  NAME  Fully qualified name to give the platform (my-account/platform-name)

OPTIONS
  -h, --help                                                                  show CLI help
  -h, --host=host
  -k, --kubeconfig=kubeconfig                                                 [default: ~/.kube/config]
  -t, --type=KUBERNETES|kubernetes|ARCHITECT_PUBLIC|architect_public|ECS|ecs
  --aws_key=aws_key
  --aws_region=aws_region
  --aws_secret=aws_secret
  --cluster_ca_cert=cluster_ca_cert                                           File path of cluster_ca_cert
  --service_token=service_token                                               Service token

ALIASES
  $ architect platform:create
  $ architect platforms:create
```

_See code: [src/commands/platforms/create.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/platforms/create.ts)_

## `architect platforms:destroy NAMESPACED_PLATFORM`

Destroy a platform

```
USAGE
  $ architect platforms:destroy NAMESPACED_PLATFORM

ARGUMENTS
  NAMESPACED_PLATFORM  Name of the platform to destroy

OPTIONS
  -a, --auto_approve  Automatically apply the changes without reviewing the diff
  -h, --help          show CLI help

ALIASES
  $ architect platform:destroy
```

_See code: [src/commands/platforms/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/platforms/destroy.ts)_

## `architect register [COMPONENT]`

Register a new Component with Architect Cloud

```
USAGE
  $ architect register [COMPONENT]

ARGUMENTS
  COMPONENT  Path to a component to register

OPTIONS
  -h, --help     show CLI help
  -t, --tag=tag  [default: latest] Tag to give to the new component

ALIASES
  $ architect component:register
  $ architect components:register
  $ architect c:register
  $ architect comp:register
```

_See code: [src/commands/register.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/register.ts)_

## `architect unlink [SERVICEPATHORNAME]`

Unlink a service from the host by path or name

```
USAGE
  $ architect unlink [SERVICEPATHORNAME]

OPTIONS
  -a, --all   Unlink all services registered locally
  -h, --help  show CLI help
```

_See code: [src/commands/unlink.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/unlink.ts)_

## `architect whoami`

Get the logged in user

```
USAGE
  $ architect whoami

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect whoami
```

_See code: [src/commands/whoami.ts](https://github.com/architect-team/architect-cli/blob/v0.5.2-rc.13/src/commands/whoami.ts)_
<!-- commandsstop -->
