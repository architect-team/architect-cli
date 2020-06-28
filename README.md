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
@architect-io/cli/0.4.10-rc.8 linux-x64 node-v12.18.1
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
* [`architect build`](#architect-build)
* [`architect config:get OPTION`](#architect-configget-option)
* [`architect config:set OPTION VALUE`](#architect-configset-option-value)
* [`architect config:view`](#architect-configview)
* [`architect deploy [ENVIRONMENT_CONFIG]`](#architect-deploy-environment_config)
* [`architect environments [QUERY]`](#architect-environments-query)
* [`architect environments:clear`](#architect-environmentsclear)
* [`architect environments:create [NAME]`](#architect-environmentscreate-name)
* [`architect environments:destroy NAMESPACED_ENVIRONMENT`](#architect-environmentsdestroy-namespaced_environment)
* [`architect environments:update NAMESPACED_ENVIRONMENT`](#architect-environmentsupdate-namespaced_environment)
* [`architect help [COMMAND]`](#architect-help-command)
* [`architect init [NAME]`](#architect-init-name)
* [`architect link [SERVICEPATH]`](#architect-link-servicepath)
* [`architect login`](#architect-login)
* [`architect logout`](#architect-logout)
* [`architect platforms [QUERY]`](#architect-platforms-query)
* [`architect platforms:destroy NAMESPACED_PLATFORM`](#architect-platformsdestroy-namespaced_platform)
* [`architect push`](#architect-push)
* [`architect register`](#architect-register)
* [`architect services [QUERY]`](#architect-services-query)
* [`architect unlink [SERVICEPATHORNAME]`](#architect-unlink-servicepathorname)
* [`architect whoami`](#architect-whoami)

## `architect build`

Build an Architect-ready Docker image for a service

```
USAGE
  $ architect build

OPTIONS
  -e, --environment=environment  Path to an environment config including local services to build
  -h, --help                     show CLI help
  -s, --services=services        Path to a service to build
  -t, --tag=tag                  [default: latest] Tag to give to the new Docker image(s)
```

_See code: [src/commands/build.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/build.ts)_

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

_See code: [src/commands/config/get.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/config/get.ts)_

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

_See code: [src/commands/config/set.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/config/set.ts)_

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

_See code: [src/commands/config/view.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/config/view.ts)_

## `architect deploy [ENVIRONMENT_CONFIG]`

Create a deploy job on Architect Cloud or run stacks locally

```
USAGE
  $ architect deploy [ENVIRONMENT_CONFIG]

ARGUMENTS
  ENVIRONMENT_CONFIG  Path to an environment config file

OPTIONS
  -a, --account=account            Account to deploy the services with
  -d, --detached                   Run in detached mode
  -e, --environment=environment    Environment to deploy the services to
  -h, --help                       show CLI help
  -l, --local                      Deploy the stack locally instead of via Architect Cloud

  -o, --compose_file=compose_file  [default: /tmp/architect-deployment-1593313359085.json] Path where the compose file
                                   should be written to

  --auto_approve
```

_See code: [src/commands/deploy.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/deploy.ts)_

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

_See code: [src/commands/environments/index.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/environments/index.ts)_

## `architect environments:clear`

Clear services from an environment

```
USAGE
  $ architect environments:clear

OPTIONS
  -a, --account=account            Account to deploy the services with
  -d, --detached                   Run in detached mode
  -e, --environment=environment    Environment to deploy the services to
  -h, --help                       show CLI help
  -l, --local                      Deploy the stack locally instead of via Architect Cloud

  -o, --compose_file=compose_file  [default: /tmp/architect-deployment-1593313359085.json] Path where the compose file
                                   should be written to

  --auto_approve

ALIASES
  $ architect environment:clear
  $ architect env:clear
```

_See code: [src/commands/environments/clear.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/environments/clear.ts)_

## `architect environments:create [NAME]`

Register a new environment with Architect Cloud

```
USAGE
  $ architect environments:create [NAME]

ARGUMENTS
  NAME  Name to give the environment

OPTIONS
  -a, --account=account
  -c, --config_file=config_file
  -h, --help                                                                  show CLI help
  -h, --host=host
  -k, --kubeconfig=kubeconfig                                                 [default: ~/.kube/config]
  -n, --namespace=namespace
  -p, --platform=platform
  -t, --type=KUBERNETES|kubernetes|ARCHITECT_PUBLIC|architect_public|ECS|ecs
  --aws_key=aws_key
  --aws_region=aws_region
  --aws_secret=aws_secret
  --cluster_ca_cert=cluster_ca_cert                                           File path of cluster_ca_cert
  --service_token=service_token                                               Service token

ALIASES
  $ architect environment:create
  $ architect environments:create
  $ architect envs:create
  $ architect env:create
```

_See code: [src/commands/environments/create.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/environments/create.ts)_

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

_See code: [src/commands/environments/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/environments/destroy.ts)_

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

_See code: [src/commands/environments/update.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/environments/update.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.3/src/commands/help.ts)_

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
  $ architect init
       ? Name of service (account/name) account-name/service-name
       ? Does your service connect to any dependencies? Yes
       ? Please provide the name of or file path to a dependent service account-name/dependency:latest
       ? What environment parameter should be enriched with the location of this dependency? DEPENDENCY_ADDR
       ? Any more dependencies? No
       ? Does your service expose any configurable parameters? Yes
       ? What is the name of this parameter? ENV_PARAM
       ? Is this parameter required? Yes
       ? What is the default value of this parameter (if any)? param_value
       ? Any more parameters? No
       ? When running locally, what command should be used to start the service (leave blank to use default docker CMD)?
       npm run start:dev
       Success! A manifest for this service has been added at `architect.json`.
```

_See code: [src/commands/init.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/init.ts)_

## `architect link [SERVICEPATH]`

Link a local service to the host to be used to power local deployments.

```
USAGE
  $ architect link [SERVICEPATH]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/link.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/link.ts)_

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

_See code: [src/commands/login.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/login.ts)_

## `architect logout`

Logout from the Architect registry

```
USAGE
  $ architect logout

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/logout.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/logout.ts)_

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
  $ architect platforms
  $ architect platforms:search
```

_See code: [src/commands/platforms/index.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/platforms/index.ts)_

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

_See code: [src/commands/platforms/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/platforms/destroy.ts)_

## `architect push`

Push service(s) to a registry

```
USAGE
  $ architect push

OPTIONS
  -e, --environment=environment  Path to an environment config including local services to build
  -h, --help                     show CLI help
  -s, --services=services        Path to a service to build
  -t, --tag=tag                  [default: latest] Tag to give to the new Docker image(s)
```

_See code: [src/commands/push.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/push.ts)_

## `architect register`

Register a new Service with Architect Cloud

```
USAGE
  $ architect register

OPTIONS
  -e, --environment=environment  Path to an environment config including local services to build
  -h, --help                     show CLI help
  -i, --image=image              The docker image of the service.
  -s, --services=services        Path to a service to build
  -t, --tag=tag                  [default: latest] Tag to give to the new service

ALIASES
  $ architect service:register
  $ architect services:register
  $ architect svcs:register
  $ architect svc:register
```

_See code: [src/commands/register.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/register.ts)_

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

_See code: [src/commands/services/index.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/services/index.ts)_

## `architect unlink [SERVICEPATHORNAME]`

Unlink a service from the host by path or name

```
USAGE
  $ architect unlink [SERVICEPATHORNAME]

OPTIONS
  -a, --all   Unlink all services registered locally
  -h, --help  show CLI help
```

_See code: [src/commands/unlink.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/unlink.ts)_

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

_See code: [src/commands/whoami.ts](https://github.com/architect-team/architect-cli/blob/v0.4.10-rc.8/src/commands/whoami.ts)_
<!-- commandsstop -->
