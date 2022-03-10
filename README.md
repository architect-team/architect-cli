<!-- docs -->

<p align="center">
  <a href="//architect.io" target="blank"><img src="//docs.architect.io/img/logo.svg" width="480" alt="Architect Logo" /></a>
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

Architect's CLI, which provides the full developer experience needed to create [components](../getting-started/introduction) and operate local [environments](../deployments/local-environments), is fully open-source. The CLI can deploy components locally using docker-compose, enrich the deployments with components found in Architect's Cloud registry, and allows developers to publish their own components to the registry both publicly and privately for free.

## Requirements
* [**Docker**](//docs.docker.com/get-docker/) must be installed
* [**Node.js** `v12`](//nodejs.org/en/download/) or higher must be installed

## Usage

<!-- usage -->
```sh-session
$ npm install -g @architect-io/cli
$ architect COMMAND
running command...
$ architect (-v|--version|version)
@architect-io/cli/1.13.1 linux-x64 node-v16.13.1
$ architect --help [COMMAND]
USAGE
  $ architect COMMAND
...
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`architect autocomplete [SHELL]`](#architect-autocomplete-shell)
* [`architect components [QUERY]`](#architect-components-query)
* [`architect components:versions [COMPONENT_NAME]`](#architect-componentsversions-component_name)
* [`architect config:get OPTION`](#architect-configget-option)
* [`architect config:set OPTION VALUE`](#architect-configset-option-value)
* [`architect config:view`](#architect-configview)
* [`architect deploy [CONFIGS_OR_COMPONENTS]`](#architect-deploy-configs_or_components)
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
* [`architect task COMPONENT TASK`](#architect-task-component-task)
* [`architect unlink [COMPONENTPATHORNAME]`](#architect-unlink-componentpathorname)
* [`architect validate [CONFIGS_OR_COMPONENTS]`](#architect-validate-configs_or_components)
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

_See code: [@oclif/plugin-autocomplete](//github.com/oclif/plugin-autocomplete/blob/v0.3.0/src/commands/autocomplete/index.ts)_

## `architect components [QUERY]`

Search components you have access to

```
USAGE
  $ architect components [QUERY]

ARGUMENTS
  QUERY  Search term used to filter the results

OPTIONS
  -a, --account=account  Architect account
  -h, --help             show CLI help

ALIASES
  $ architect components
  $ architect components:search
  $ architect component:search
  $ architect component:search
```

_See code: [src/commands/components/index.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/components/index.ts)_

## `architect components:versions [COMPONENT_NAME]`

Search component versions of a particular component

```
USAGE
  $ architect components:versions [COMPONENT_NAME]

OPTIONS
  -a, --account=account  Architect account
  -h, --help             show CLI help

ALIASES
  $ architect component:versions
  $ architect component:version
```

_See code: [src/commands/components/versions.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/components/versions.ts)_

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

_See code: [src/commands/config/get.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/config/get.ts)_

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

_See code: [src/commands/config/set.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/config/set.ts)_

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

_See code: [src/commands/config/view.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/config/view.ts)_

## `architect dev [CONFIGS_OR_COMPONENTS]`

Run your stacks locally

```
USAGE
  $ architect dev [CONFIGS_OR_COMPONENTS]

ARGUMENTS
  CONFIGS_OR_COMPONENTS  Path to an architect.yml file or component `account/component:latest`. Multiple components are
                         accepted.

OPTIONS
  -e, --environment=environment    Architect environment
  -h, --help                       show CLI help
  -i, --interface=interface        [default: ] Component interfaces
  -o, --compose-file=compose-file  Path where the compose file should be written to
  -p, --parameter=parameter        [default: ] Component parameters
  -r, --[no-]recursive             [default: true] Toggle to automatically deploy all dependencies
  -s, --secrets=secrets            Path of secrets file
  --[no-]browser                   [default: true] Automatically open urls in the browser for local deployments
  --build-parallel                 [default: false] Build docker images in parallel
  --production                     Build and run components without debug blocks
```

_See code: [src/commands/dev.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/dev.ts)_

## `architect deploy [CONFIGS_OR_COMPONENTS]`

Create a deploy job on Architect Cloud

```
USAGE
  $ architect deploy [CONFIGS_OR_COMPONENTS]

ARGUMENTS
  CONFIGS_OR_COMPONENTS  Path to an architect.yml file or component `account/component:latest`. Multiple components are
                         accepted.

OPTIONS
  -a, --account=account            Architect account
  -d, --detached                   Run in detached mode
  -e, --environment=environment    Architect environment
  -h, --help                       show CLI help
  -i, --interface=interface        [default: ] Component interfaces
  -o, --compose-file=compose-file  Path where the compose file should be written to
  -p, --parameter=parameter        [default: ] Component parameters
  -r, --[no-]recursive             [default: true] Toggle to automatically deploy all dependencies
  -s, --secrets=secrets            Path of secrets file

  --auto-approve                   Automatically approve the deployment without a review step. Used for debugging and CI
                                   flows.

  --[no-]browser                   [default: true] Automatically open urls in the browser for local deployments

  --build-parallel                 [default: false] Build docker images in parallel

  --[no-]deletion-protection       [default: true] Toggle for deletion protection on deployments

  --production                     Build and run components without debug blocks
```

_See code: [src/commands/deploy.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/deploy.ts)_

## `architect destroy`

Destroy components from an environment

```
USAGE
  $ architect destroy

OPTIONS
  -a, --account=account          Architect account
  -c, --components=components    Component(s) to destroy
  -e, --environment=environment  Architect environment
  -h, --help                     show CLI help

  --auto-approve                 Automatically approve the deployment without a review step. Used for debugging and CI
                                 flows.
```

_See code: [src/commands/destroy.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/destroy.ts)_

## `architect environments [QUERY]`

Search environments you have access to

```
USAGE
  $ architect environments [QUERY]

ARGUMENTS
  QUERY  Search term used to filter the results

OPTIONS
  -a, --account=account  Architect account
  -h, --help             show CLI help

ALIASES
  $ architect environments
  $ architect envs
  $ architect env
  $ architect environments:search
  $ architect envs:search
  $ architect env:search
```

_See code: [src/commands/environments/index.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/environments/index.ts)_

## `architect environments:create [ENVIRONMENT]`

Register a new environment with Architect Cloud

```
USAGE
  $ architect environments:create [ENVIRONMENT]

ARGUMENTS
  ENVIRONMENT  Name to give the environment

OPTIONS
  -a, --account=account      Architect account
  -h, --help                 show CLI help
  --description=description  Environment Description
  --platform=platform        Architect platform
  --ttl=ttl                  The TTL of the environment in a duration of time, ex. 30d, 12h, or 30m

ALIASES
  $ architect environment:create
  $ architect envs:create
  $ architect env:create
```

_See code: [src/commands/environments/create.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/environments/create.ts)_

## `architect environments:destroy [ENVIRONMENT]`

Deregister an environment

```
USAGE
  $ architect environments:destroy [ENVIRONMENT]

ARGUMENTS
  ENVIRONMENT  Name of the environment to deregister

OPTIONS
  -a, --account=account  Architect account
  -f, --force            Force the deletion even if the environment is not empty
  -h, --help             show CLI help
  --auto-approve         Automatically apply the changes

ALIASES
  $ architect environment:destroy
  $ architect envs:destroy
  $ architect env:destroy
  $ architect env:deregister
  $ architect environment:deregister
```

_See code: [src/commands/environments/destroy.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/environments/destroy.ts)_

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

_See code: [@oclif/plugin-help](//github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_

## `architect init`

Initialize an architect component from an existing docker-compose file

```
USAGE
  $ architect init

OPTIONS
  -a, --account=account
  -h, --help                           show CLI help
  -n, --name=name
  -o, --component-file=component-file  [default: architect.yml] Path where the component file should be written to
  --from-compose=from-compose          [default: /home/runner/work/architect-cli/architect-cli]
```

_See code: [src/commands/init.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/init.ts)_

## `architect link [COMPONENTPATH]`

Link a local component to the host to be used to power local deployments.

```
USAGE
  $ architect link [COMPONENTPATH]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/link.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/link.ts)_

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

_See code: [src/commands/login.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/login.ts)_

## `architect logout`

Logout from the Architect registry

```
USAGE
  $ architect logout

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/logout.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/logout.ts)_

## `architect platforms [QUERY]`

Search for platforms on Architect Cloud

```
USAGE
  $ architect platforms [QUERY]

ARGUMENTS
  QUERY  Search query used to filter results

OPTIONS
  -a, --account=account  Architect account
  -h, --help             show CLI help

ALIASES
  $ architect platform
  $ architect platform:search
  $ architect platforms
  $ architect platforms:search
```

_See code: [src/commands/platforms/index.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/platforms/index.ts)_

## `architect platforms:create [PLATFORM]`

Register a new platform with Architect Cloud

```
USAGE
  $ architect platforms:create [PLATFORM]

ARGUMENTS
  PLATFORM  Name to give the platform

OPTIONS
  -a, --account=account                     Architect account
  -h, --help                                show CLI help
  -h, --host=host
  -k, --kubeconfig=kubeconfig               [default: ~/.kube/config]
  -t, --type=KUBERNETES|kubernetes|ECS|ecs
  --auto-approve
  --aws-key=aws-key
  --aws-region=aws-region
  --aws-secret=aws-secret
  --flag=flag                               [default: ]

ALIASES
  $ architect platforms:register
  $ architect platform:create
  $ architect platforms:create
```

_See code: [src/commands/platforms/create.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/platforms/create.ts)_

## `architect platforms:destroy [PLATFORM]`

Deregister a platform from Architect

```
USAGE
  $ architect platforms:destroy [PLATFORM]

ARGUMENTS
  PLATFORM  Name of the platform to deregister

OPTIONS
  -a, --account=account  Architect account
  -f, --force            Force the deletion even if the platform is not empty
  -h, --help             show CLI help
  --auto-approve         Automatically apply the changes

ALIASES
  $ architect platforms:deregister
  $ architect platform:destroy
  $ architect platforms:destroy
```

_See code: [src/commands/platforms/destroy.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/platforms/destroy.ts)_

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
  --arg=arg      Build arg(s) to pass to docker build

ALIASES
  $ architect component:register
  $ architect components:register
  $ architect c:register
  $ architect comp:register
```

_See code: [src/commands/register.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/register.ts)_

## `architect task COMPONENT TASK`

Execute a task in the given environment

```
USAGE
  $ architect task COMPONENT TASK

ARGUMENTS
  COMPONENT  The name of the component that contains the task to execute
  TASK       The name of the task to execute

OPTIONS
  -a, --account=account            Architect account
  -e, --environment=environment    Architect environment
  -h, --help                       show CLI help
  -l, --local                      Deploy the stack locally instead of via Architect Cloud
  -o, --compose-file=compose-file  Path where the compose file should be written to

ALIASES
  $ architect task:exec
```

_See code: [src/commands/task.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/task.ts)_

## `architect unlink [COMPONENTPATHORNAME]`

Unlink a component from the host by path or name

```
USAGE
  $ architect unlink [COMPONENTPATHORNAME]

OPTIONS
  -h, --help  show CLI help
  --all       Unlink all components registered locally
```

_See code: [src/commands/unlink.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/unlink.ts)_

## `architect validate [CONFIGS_OR_COMPONENTS]`

Validate that an architect.yml is syntactically correct.

```
USAGE
  $ architect validate [CONFIGS_OR_COMPONENTS]

ARGUMENTS
  CONFIGS_OR_COMPONENTS  Path to an architect.yml file or component `account/component:latest`. Multiple components are
                         accepted.

OPTIONS
  -h, --help  show CLI help

ALIASES
  $ architect component:validate
  $ architect components:validate
  $ architect c:validate
  $ architect comp:validate
  $ architect validate
```

_See code: [src/commands/validate.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/validate.ts)_

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

_See code: [src/commands/whoami.ts](//github.com/architect-team/architect-cli/blob/v1.13.1/src/commands/whoami.ts)_
<!-- commandsstop -->
