<!-- docs -->

<p align="center">
  <a href="//architect.io" target="blank"><img src="https://www.architect.io/logo.svg" width="480" alt="Architect Logo" /></a>
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

Architect is the world's first [DevOps-as-a-Service](https://www.architect.io/how-it-works) toolset designed to help democratize environment provisioning for engineers. With Architect, anyone can deploy any service, anywhere, for any reason with the push of a button.

Our unique approach to continuous delivery is powered by an embedded dependency resolver. By simply asserting your microservice dependenies, Architect is able to build a graph of your application and deploy the entire stack to your favorite cloud provider.

Architect's CLI, which provides the full developer experience needed to create [components](https://www.architect.io/docs/getting-started/core-concepts#components) and operate local [environments](https://www.architect.io/docs/getting-started/core-concepts#environments), is fully open-source. The CLI can deploy components locally using docker-compose, enrich the deployments with components found in Architect's Cloud registry, and allows developers to publish their own components to the registry both publicly and privately for free.

# Usage

<!-- usage -->
```sh-session
$ npm install -g @architect-io/cli
$ architect COMMAND
running command...
$ architect (-v|--version|version)
@architect-io/cli/0.7.6 linux-x64 node-v12.18.4
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
* [`architect autocomplete [SHELL]`](#architect-autocomplete-shell)
* [`architect config:get OPTION`](#architect-configget-option)
* [`architect config:set OPTION VALUE`](#architect-configset-option-value)
* [`architect config:view`](#architect-configview)
* [`architect deploy ENVIRONMENT_CONFIG_OR_COMPONENT`](#architect-deploy-environment_config_or_component)
* [`architect destroy`](#architect-destroy)
* [`architect environments [QUERY]`](#architect-environments-query)
* [`architect environments:create [ENVIRONMENT]`](#architect-environmentscreate-environment)
* [`architect environments:destroy [ENVIRONMENT]`](#architect-environmentsdestroy-environment)
* [`architect help [COMMAND]`](#architect-help-command)
* [`architect init`](#architect-init)
* [`architect link [COMPONENTPATH]`](#architect-link-componentpath)
* [`architect login`](#architect-login)
* [`architect logout`](#architect-logout)
* [`architect platforms [QUERY]`](#architect-platforms-query)
* [`architect platforms:create [PLATFORM]`](#architect-platformscreate-platform)
* [`architect platforms:destroy [PLATFORM]`](#architect-platformsdestroy-platform)
* [`architect register [COMPONENT]`](#architect-register-component)
* [`architect unlink [COMPONENTPATHORNAME]`](#architect-unlink-componentpathorname)
* [`architect whoami`](#architect-whoami)

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

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v0.2.0/src/commands/autocomplete/index.ts)_

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

_See code: [src/commands/config/get.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/config/get.ts)_

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

_See code: [src/commands/config/set.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/config/set.ts)_

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

_See code: [src/commands/config/view.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/config/view.ts)_

## `architect deploy ENVIRONMENT_CONFIG_OR_COMPONENT`

Create a deploy job on Architect Cloud or run stacks locally

```
USAGE
  $ architect deploy ENVIRONMENT_CONFIG_OR_COMPONENT

ARGUMENTS
  ENVIRONMENT_CONFIG_OR_COMPONENT  Path to an environment config file or component `account/component:latest`

OPTIONS
  -a, --account=account            Architect Account
  -d, --detached                   Run in detached mode
  -e, --environment=environment    Architect Environment
  -h, --help                       show CLI help
  -i, --interface=interface        [default: ] Component interfaces
  -l, --local                      Deploy the stack locally instead of via Architect Cloud

  -o, --compose_file=compose_file  [default: /tmp/architect-deployment-1602170675205.yml] Path where the compose file
                                   should be written to

  -p, --parameter=parameter        [default: ] Component parameters

  --auto_approve

  --[no-]browser
```

_See code: [src/commands/deploy.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/deploy.ts)_

## `architect destroy`

Destroy components from an environment

```
USAGE
  $ architect destroy

OPTIONS
  -a, --account=account          Architect Account
  -c, --components=components    Component(s) to destroy
  -e, --environment=environment  Architect Environment
  -h, --help                     show CLI help
  --auto_approve
  --[no-]browser
```

_See code: [src/commands/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/destroy.ts)_

## `architect environments [QUERY]`

Search environments you have access to

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
  $ architect environments:search
  $ architect envs:search
  $ architect env:search
```

_See code: [src/commands/environments/index.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/environments/index.ts)_

## `architect environments:create [ENVIRONMENT]`

Register a new environment with Architect Cloud

```
USAGE
  $ architect environments:create [ENVIRONMENT]

ARGUMENTS
  ENVIRONMENT  Name to give the environment

OPTIONS
  -a, --account=account      Architect Account
  -h, --help                 show CLI help
  --description=description  Environment Description
  --platform=platform        Architect Platform

ALIASES
  $ architect environment:create
  $ architect envs:create
  $ architect env:create
```

_See code: [src/commands/environments/create.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/environments/create.ts)_

## `architect environments:destroy [ENVIRONMENT]`

Destroy an environment

```
USAGE
  $ architect environments:destroy [ENVIRONMENT]

ARGUMENTS
  ENVIRONMENT  Name of the environment to destroy

OPTIONS
  -a, --account=account  Architect Account
  -f, --force            Force the deletion even if the environment is not empty
  -h, --help             show CLI help
  --auto_approve         Automatically apply the changes

ALIASES
  $ architect environment:destroy
  $ architect envs:destroy
  $ architect env:destroy
```

_See code: [src/commands/environments/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/environments/destroy.ts)_

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

## `architect init`

Initialize an architect component from an existing docker-compose file

```
USAGE
  $ architect init

OPTIONS
  -a, --account=account
  -h, --help                           show CLI help
  -n, --name=name
  -o, --component_file=component_file  [default: architect.yml] Path where the component file should be written to
  --from_compose=from_compose          [default: /home/runner/work/architect-cli/architect-cli]
```

_See code: [src/commands/init.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/init.ts)_

## `architect link [COMPONENTPATH]`

Link a local component to the host to be used to power local deployments.

```
USAGE
  $ architect link [COMPONENTPATH]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/link.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/link.ts)_

## `architect login`

Login to the Architect Cloud platform

```
USAGE
  $ architect login

OPTIONS
  -e, --email=email        Email
  -h, --help               show CLI help
  -p, --password=password  Password
```

_See code: [src/commands/login.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/login.ts)_

## `architect logout`

Logout from the Architect registry

```
USAGE
  $ architect logout

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/logout.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/logout.ts)_

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

_See code: [src/commands/platforms/index.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/platforms/index.ts)_

## `architect platforms:create [PLATFORM]`

Register a new platform with Architect Cloud

```
USAGE
  $ architect platforms:create [PLATFORM]

ARGUMENTS
  PLATFORM  Name to give the platform

OPTIONS
  -a, --account=account                                         Architect Account
  -h, --help                                                    show CLI help
  -h, --host=host
  -k, --kubeconfig=kubeconfig                                   [default: ~/.kube/config]
  -t, --type=KUBERNETES|kubernetes|ARCHITECT|architect|ECS|ecs
  --aws_key=aws_key
  --aws_region=aws_region
  --aws_secret=aws_secret
  --cluster_ca_cert=cluster_ca_cert                             File path of cluster_ca_cert
  --service_token=service_token                                 Service token

ALIASES
  $ architect platform:create
  $ architect platforms:create
```

_See code: [src/commands/platforms/create.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/platforms/create.ts)_

## `architect platforms:destroy [PLATFORM]`

Destroy a platform

```
USAGE
  $ architect platforms:destroy [PLATFORM]

ARGUMENTS
  PLATFORM  Name of the platform to destroy

OPTIONS
  -a, --account=account  Architect Account
  -h, --help             show CLI help
  --auto_approve         Automatically apply the changes

ALIASES
  $ architect platform:destroy
  $ architect platforms:destroy
```

_See code: [src/commands/platforms/destroy.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/platforms/destroy.ts)_

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

_See code: [src/commands/register.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/register.ts)_

## `architect unlink [COMPONENTPATHORNAME]`

Unlink a component from the host by path or name

```
USAGE
  $ architect unlink [COMPONENTPATHORNAME]

OPTIONS
  -h, --help  show CLI help
  --all       Unlink all components registered locally
```

_See code: [src/commands/unlink.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/unlink.ts)_

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

_See code: [src/commands/whoami.ts](https://github.com/architect-team/architect-cli/blob/v0.7.6/src/commands/whoami.ts)_
<!-- commandsstop -->
