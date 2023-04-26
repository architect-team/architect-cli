<!-- docs -->

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.architect.io/logo/horizontal-inverted.png"/>
    <source media="(prefers-color-scheme: light)" srcset="https://cdn.architect.io/logo/horizontal.png"/>
    <img width="320" alt="Architect Logo" src="https://cdn.architect.io/logo/horizontal.png"/>
  </picture>
</p>

<p align="center">
  <a href="https://oclif.io"><img src="https://img.shields.io/badge/cli-oclif-brightgreen.svg" alt="oclif" /></a>
  <a href="https://github.com/architect-team/architect-cli/actions?query=workflow%3A%22CLI+-+Cut+Release+Candidate%22"><img src="https://img.shields.io/github/workflow/status/architect-team/architect-cli/CLI%20-%20Cut%20Release%20Candidate" alt="Build" /></a>
  <a href="https://npmjs.org/package/@architect-io/cli"><img src="https://img.shields.io/npm/v/@architect-io/cli.svg" alt="Version" /></a>
  <a href="https://github.com/architect-team/architect-cli/blob/main/package.json"><img src="https://img.shields.io/npm/l/@architect-io/cli.svg" alt="License" /></a>
</p>

<p align="center">
  Self-service cloud environments for everyone. Achieve deployment, networking, and security automation all at once with Architect.
</p>

---

Architect is the world's first [DevOps-as-a-Service](https://architect.io/product) toolset designed to help democratize environment provisioning for engineers. With Architect, anyone can deploy any service, anywhere, for any reason with the push of a button.

Our unique approach to continuous delivery is powered by an embedded dependency resolver. By simply asserting your microservice dependenies, Architect is able to build a graph of your application and deploy the entire stack to your favorite cloud provider.

Architect's CLI, which provides the full developer experience needed to create [components](https://docs.architect.io) and operate local [environments](https://docs.architect.io/deployments/local-environments), is fully open-source. The CLI can deploy components locally using docker-compose, enrich the deployments with components found in Architect's Cloud registry, and allows developers to publish their own components to the registry both publicly and privately for free.

## Requirements
* [**Docker**](https://docs.docker.com/get-docker/) must be installed
* [**Node.js** `v14`](https://nodejs.org/en/download/) or higher must be installed

## Usage

<!-- usage -->
```sh-session
$ npm install -g @architect-io/cli
$ architect COMMAND
running command...
$ architect (--version)
@architect-io/cli/1.39.0-rc.7 linux-x64 node-v16.20.0
$ architect --help [COMMAND]
USAGE
  $ architect COMMAND
...
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`architect autocomplete [SHELL]`](#architect-autocomplete-shell)
* [`architect clusters [QUERY]`](#architect-clusters-query)
* [`architect clusters:create [CLUSTER]`](#architect-clusterscreate-cluster)
* [`architect clusters:destroy [CLUSTER]`](#architect-clustersdestroy-cluster)
* [`architect components:versions [COMPONENT_NAME]`](#architect-componentsversions-component_name)
* [`architect config:get OPTION`](#architect-configget-option)
* [`architect config:set OPTION VALUE`](#architect-configset-option-value)
* [`architect config:view`](#architect-configview)
* [`architect deploy [CONFIGS_OR_COMPONENTS]`](#architect-deploy-configs_or_components)
* [`architect destroy`](#architect-destroy)
* [`architect dev [CONFIGS_OR_COMPONENTS]`](#architect-dev-configs_or_components)
* [`architect dev:list`](#architect-devlist)
* [`architect dev:restart [SERVICES]`](#architect-devrestart-services)
* [`architect dev:stop [NAME]`](#architect-devstop-name)
* [`architect doctor`](#architect-doctor)
* [`architect environments:create [ENVIRONMENT]`](#architect-environmentscreate-environment)
* [`architect environments:destroy [ENVIRONMENT]`](#architect-environmentsdestroy-environment)
* [`architect environments:ingresses [ENVIRONMENT]`](#architect-environmentsingresses-environment)
* [`architect exec [RESOURCE] [FLAGS] -- [COMMAND]`](#architect-exec-resource-flags----command)
* [`architect help [COMMAND]`](#architect-help-command)
* [`architect init [NAME]`](#architect-init-name)
* [`architect link [COMPONENTPATH]`](#architect-link-componentpath)
* [`architect link:list`](#architect-linklist)
* [`architect login`](#architect-login)
* [`architect logout`](#architect-logout)
* [`architect logs [RESOURCE]`](#architect-logs-resource)
* [`architect port-forward [RESOURCE] [FLAGS]`](#architect-port-forward-resource-flags)
* [`architect register [COMPONENT]`](#architect-register-component)
* [`architect scale [SERVICE]`](#architect-scale-service)
* [`architect secrets:download SECRETS_FILE`](#architect-secretsdownload-secrets_file)
* [`architect secrets:upload SECRETS_FILE`](#architect-secretsupload-secrets_file)
* [`architect task COMPONENT TASK`](#architect-task-component-task)
* [`architect unlink [COMPONENTPATHORNAME]`](#architect-unlink-componentpathorname)

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

## `architect clusters [QUERY]`

Search for clusters on Architect Cloud

```
USAGE
  $ architect clusters [QUERY] [-a <value>]

ARGUMENTS
  QUERY  Search query used to filter results

FLAGS
  -a, --account=<value>  Architect account

DESCRIPTION
  Search for clusters on Architect Cloud

ALIASES
  $ architect cluster
  $ architect cluster:search
  $ architect cluster:list
  $ architect clusters:search
  $ architect clusters:list

EXAMPLES
  $ architect clusters

  $ architect clusters --account=myaccount mycluster
```

_See code: [src/commands/clusters/index.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/clusters/index.ts)_

## `architect clusters:create [CLUSTER]`

Register a new cluster with Architect Cloud

```
USAGE
  $ architect clusters:create [CLUSTER] [-a <value>] [--auto-approve <value>] [-t AGENT|agent] [-k <value> | -h
    <value>] [--flag <value>]

ARGUMENTS
  CLUSTER  Name to give the cluster

FLAGS
  -a, --account=<value>     Architect account
  -h, --host=<value>
  -k, --kubeconfig=<value>  [default: ~/.kube/config]
  -t, --type=<option>       <options: AGENT|agent>
  --auto-approve=<value>
  --flag=<value>...         [default: ]

DESCRIPTION
  Register a new cluster with Architect Cloud

ALIASES
  $ architect clusters:register
  $ architect cluster:create

EXAMPLES
  $ architect clusters:create --account=myaccount

  $ architect clusters:register --account=myaccount --kubeconfig=~/.kube/config --auto-approve
```

_See code: [src/commands/clusters/create.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/clusters/create.ts)_

## `architect clusters:destroy [CLUSTER]`

Deregister a cluster from Architect

```
USAGE
  $ architect clusters:destroy [CLUSTER] [-a <value>] [--auto-approve <value>] [-f <value>]

ARGUMENTS
  CLUSTER  Name of the cluster to deregister

FLAGS
  -a, --account=<value>   Architect account
  -f, --force=<value>     Force the deletion even if the cluster is not empty
  --auto-approve=<value>  Automatically apply the changes

DESCRIPTION
  Deregister a cluster from Architect

ALIASES
  $ architect clusters:deregister
  $ architect cluster:destroy

EXAMPLES
  $ architect cluster:destroy --account=myaccount architect

  $ architect clusters:deregister --account=myaccount --auto-approve --force architect
```

_See code: [src/commands/clusters/destroy.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/clusters/destroy.ts)_

## `architect components:versions [COMPONENT_NAME]`

Search component versions of a particular component

```
USAGE
  $ architect components:versions [COMPONENT_NAME] [-a <value>]

FLAGS
  -a, --account=<value>  Architect account

DESCRIPTION
  Search component versions of a particular component

ALIASES
  $ architect component:versions
  $ architect component:version

EXAMPLES
  $ architect component:versions mycomponent

  $ architect component:versions --account=myaccount mycomponent
```

_See code: [src/commands/components/versions.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/components/versions.ts)_

## `architect config:get OPTION`

Get the value of a CLI config option

```
USAGE
  $ architect config:get [OPTION]

ARGUMENTS
  OPTION  Name of a config option

DESCRIPTION
  Get the value of a CLI config option

EXAMPLES
  $ architect config:get log_level
```

_See code: [src/commands/config/get.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/config/get.ts)_

## `architect config:set OPTION VALUE`

Set a new value for a CLI configuration option

```
USAGE
  $ architect config:set [OPTION] [VALUE]

ARGUMENTS
  OPTION  Name of a config option
  VALUE   New value to assign to a config option

DESCRIPTION
  Set a new value for a CLI configuration option

EXAMPLES
  $ architect config:set log_level info
```

_See code: [src/commands/config/set.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/config/set.ts)_

## `architect config:view`

View all the CLI configuration settings

```
USAGE
  $ architect config:view

DESCRIPTION
  View all the CLI configuration settings

ALIASES
  $ architect config

EXAMPLES
  $ architect config
```

_See code: [src/commands/config/view.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/config/view.ts)_

## `architect deploy [CONFIGS_OR_COMPONENTS]`

Create a deploy job on Architect Cloud

```
USAGE
  $ architect deploy [CONFIGS_OR_COMPONENTS] [--auto-approve <value> | -o <value> | ] [-a <value>] [-e
    <value>] [--production <value> ] [-d <value> ] [--secret-file <value>] [-s <value>] [--deletion-protection <value> |
    ] [-r <value>] [--browser <value>] [--arg <value>] [--architecture <value>] [--cache-directory <value>]

ARGUMENTS
  CONFIGS_OR_COMPONENTS  Path to an architect.yml file or component `component:latest`. Multiple components are
                         accepted.

FLAGS
  -a, --account=<value>          Architect account
  -d, --detached=<value>         Run in detached mode
  -e, --environment=<value>      Architect environment
  -o, --compose-file=<value>     Path where the compose file should be written to
  -r, --recursive=<value>        [default: true] Toggle to automatically deploy all dependencies
  -s, --secret=<value>...        [default: ] An individual secret key and value in the form SECRET_KEY=SECRET_VALUE
  --architecture=<value>...      [default: amd64] Architecture(s) to target for Docker image builds
  --arg=<value>...               Build arg(s) to pass to docker build
  --auto-approve=<value>         Automatically approve the deployment without a review step. Used for debugging and CI
                                 flows.
  --browser=<value>              [default: true] Automatically open urls in the browser for local deployments
  --cache-directory=<value>      Directory to write build cache to. Do not use in Github Actions:
                                 https://docs.architect.io/deployments/automated-previews/#caching-between-workflow-runs
  --deletion-protection=<value>  [default: true] Toggle for deletion protection on deployments
  --production=<value>           Please use --environment.
  --secret-file=<value>...       [default: ] Path of secrets file

DESCRIPTION
  Create a deploy job on Architect Cloud

EXAMPLES
  $ architect deploy mycomponent:latest

  $ architect deploy ./myfolder/architect.yml --secret-file=./mysecrets.yml --environment=myenvironment --account=myaccount --auto-approve
```

_See code: [src/commands/deploy.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/deploy.ts)_

## `architect destroy`

Destroy components from an environment

```
USAGE
  $ architect destroy [--auto-approve <value> |  | ] [-a <value>] [-e <value>] [-c <value>]

FLAGS
  -a, --account=<value>        Architect account
  -c, --components=<value>...  Component(s) to destroy
  -e, --environment=<value>    Architect environment
  --auto-approve=<value>       Automatically approve the deployment without a review step. Used for debugging and CI
                               flows.

DESCRIPTION
  Destroy components from an environment

EXAMPLES
  $ architect destroy --account=myaccount --auto-approve

  $ architect destroy --account=myaccount --environment=myenvironment --auto-approve
```

_See code: [src/commands/destroy.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/destroy.ts)_

## `architect dev [CONFIGS_OR_COMPONENTS]`

Run your stack locally

```
USAGE
  $ architect dev [CONFIGS_OR_COMPONENTS] [-a <value>] [-o <value> | -e <value>] [--secret-file <value>]
    [-s <value>] [-r <value>] [--browser <value>] [--port <value>] [-d <value>] [--wait-timeout <value>] [--debug
    <value>] [--arg <value>] [--ssl <value>]

ARGUMENTS
  CONFIGS_OR_COMPONENTS  Path to an architect.yml file or component `component:latest`. Multiple components are
                         accepted.

FLAGS
  -a, --account=<value>       Architect account
  -d, --detached=<value>      Run in detached mode
  -e, --environment=<value>   Name of environment created locally during dev. This is only local and will not reflect in
                              your architect account
  -o, --compose-file=<value>  Path where the compose file should be written to
  -r, --recursive=<value>     [default: true] Toggle to automatically deploy all dependencies
  -s, --secret=<value>...     [default: ] An individual secret key and value in the form SECRET_KEY=SECRET_VALUE
  --arg=<value>...            Build arg(s) to pass to docker build
  --browser=<value>           [default: true] Automatically open urls in the browser for local deployments
  --debug=<value>             [default: true] Turn debug mode on (true) or off (false)
  --port=<value>              Port for the gateway. Defaults to 443, or 80 if --ssl=false. Allowed port numbers are 80,
                              443, or any port between 1024 and 66535.
  --secret-file=<value>...    [default: ] Path of secrets file
  --ssl=<value>               [default: true] Use https for all ingresses
  --wait-timeout=<value>      [default: 10m] Time to wait for services to be ready/healthy before detaching.

DESCRIPTION
  Run your stack locally

EXAMPLES
  $ architect dev ./mycomponent/architect.yml

  $ architect dev ./mycomponent/architect.yml -a myaccount --secrets-env=myenvironment

  $ architect dev --port=1234 --browser=false --debug=true --secret-file=./mycomponent/mysecrets.yml ./mycomponent/architect.yml
```

_See code: [src/commands/dev/index.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/dev/index.ts)_

## `architect dev:list`

List all running dev instances.

```
USAGE
  $ architect dev:list [-f TABLE|table|JSON|json]

FLAGS
  -f, --format=<option>  [default: table] Format to output data in. Table or JSON
                         <options: TABLE|table|JSON|json>

DESCRIPTION
  List all running dev instances.

EXAMPLES
  $ architect dev:list
```

_See code: [src/commands/dev/list.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/dev/list.ts)_

## `architect dev:restart [SERVICES]`

Restart or rebuild a running service

```
USAGE
  $ architect dev:restart [SERVICES] [-e <value>] [-b <value>]

ARGUMENTS
  SERVICES  Name of the service(s) to restart

FLAGS
  -b, --build=<value>        [default: true] Rebuild the services image before restarting (defaults to true)
  -e, --environment=<value>  Architect environment

DESCRIPTION
  Restart or rebuild a running service

EXAMPLES
  $ architect dev:restart

  $ architect dev:restart --build=false hello-world.services.api

  $ architect dev:restart hello-world.services.api hello-world.services.app
```

_See code: [src/commands/dev/restart.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/dev/restart.ts)_

## `architect dev:stop [NAME]`

Stop a local deployment

```
USAGE
  $ architect dev:stop [NAME]

ARGUMENTS
  NAME  Name of local environment

DESCRIPTION
  Stop a local deployment

EXAMPLES
  $ architect dev:stop <local-environment-name>
```

_See code: [src/commands/dev/stop.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/dev/stop.ts)_

## `architect doctor`

Get debugging information for troubleshooting

```
USAGE
  $ architect doctor

FLAGS
  -o, --output=<value>  Choose a file to output the debug information to

DESCRIPTION
  Get debugging information for troubleshooting

EXAMPLES
  $ architect doctor

  $ architect doctor -o ./myoutput.yml
```

_See code: [src/commands/doctor.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/doctor.ts)_

## `architect environments:create [ENVIRONMENT]`

Register a new environment with Architect Cloud

```
USAGE
  $ architect environments:create [ENVIRONMENT] [-a <value>] [--cluster <value> | --platform <value>] [--description
    <value>] [--ttl <value>]

ARGUMENTS
  ENVIRONMENT  Name to give the environment

FLAGS
  -a, --account=<value>  Architect account
  --cluster=<value>      Architect cluster
  --description=<value>  Environment Description
  --platform=<value>     Architect cluster
  --ttl=<value>          The TTL of the environment in a duration of time, ex. 30d, 12h, or 30m

DESCRIPTION
  Register a new environment with Architect Cloud

ALIASES
  $ architect environment:create
  $ architect envs:create
  $ architect env:create

EXAMPLES
  environment:create --account=myaccount myenvironment

  environment:create --account=myaccount --ttl=5days --description="My new temporary Architect environment" myenvironment
```

_See code: [src/commands/environments/create.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/environments/create.ts)_

## `architect environments:destroy [ENVIRONMENT]`

Deregister an environment

```
USAGE
  $ architect environments:destroy [ENVIRONMENT] [-a <value>] [--auto-approve <value>] [-f <value>]

ARGUMENTS
  ENVIRONMENT  Name of the environment to deregister

FLAGS
  -a, --account=<value>   Architect account
  -f, --force=<value>     Force the deletion even if the environment is not empty
  --auto-approve=<value>  Automatically apply the changes

DESCRIPTION
  Deregister an environment

ALIASES
  $ architect environment:destroy
  $ architect envs:destroy
  $ architect env:destroy
  $ architect env:deregister
  $ architect environment:deregister

EXAMPLES
  $ architect environment:destroy --account=myaccount myenvironment

  $ architect environment:deregister --account=myaccount --auto-approve --force myenvironment
```

_See code: [src/commands/environments/destroy.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/environments/destroy.ts)_

## `architect environments:ingresses [ENVIRONMENT]`

List the resolvable URLs for services exposed by your environment

```
USAGE
  $ architect environments:ingresses [ENVIRONMENT] [-a <value>]

ARGUMENTS
  ENVIRONMENT  Name to give the environment

FLAGS
  -a, --account=<value>  Architect account

DESCRIPTION
  List the resolvable URLs for services exposed by your environment

ALIASES
  $ architect environment:ingresses
  $ architect envs:ingresses
  $ architect env:ingresses
```

_See code: [src/commands/environments/ingresses.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/environments/ingresses.ts)_

## `architect exec [RESOURCE] [FLAGS] -- [COMMAND]`

Exec into service instances

```
USAGE
  $ architect exec [RESOURCE] [FLAGS] -- [COMMAND]

ARGUMENTS
  RESOURCE  Name of resource

FLAGS
  -a, --account=<value>      Architect account
  -e, --environment=<value>  Architect environment
  -i, --stdin=<value>        [default: true] Pass stdin to the container. Only works on remote deploys.
  -r, --replica=<value>      Replica index for service. Only works on remote deploys.
  -t, --tty=<value>          Stdin is a TTY. If the flag isn't supplied, tty or no-tty is automatically detected.

DESCRIPTION
  Exec into service instances

EXAMPLES
  $ architect exec -- ls

  $ architect exec -- /bin/sh

  $ architect exec --account myaccount --environment myenvironment mycomponent.services.app -- /bin/sh

  $ architect exec --account myaccount --environment myenvironment mycomponent.services.app --replica 0 -- /bin/sh
```

_See code: [src/commands/exec.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/exec.ts)_

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

## `architect init [NAME]`

Initialize an architect component from an existing docker-compose file or create a project from Architect starter projects.

```
USAGE
  $ architect init [NAME] [-o <value>] [--from-compose <value>] [-s <value>]

ARGUMENTS
  NAME  Name of your project

FLAGS
  -o, --component-file=<value>  [default: architect.yml] Path where the component file should be written to
  -s, --starter=<value>         Specify a starter project template to use as the base of your new Architect component.
  --from-compose=<value>

DESCRIPTION
  Initialize an architect component from an existing docker-compose file or create a project from Architect starter
  projects.

EXAMPLES
  $ architect init

  $ architect init mycomponent-or-myproject

  $ architect init --from-compose=mycompose.yml --component-file=architect.yml
```

_See code: [src/commands/init.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/init.ts)_

## `architect link [COMPONENTPATH]`

Link a local component to the host to be used to power local deployments.

```
USAGE
  $ architect link [COMPONENTPATH]

ARGUMENTS
  COMPONENTPATH  [default: .] The path of the component to link

DESCRIPTION
  Link a local component to the host to be used to power local deployments.

EXAMPLES
  $ architect link

  $ architect link -p ./mycomponent/architect.yml
```

_See code: [src/commands/link/index.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/link/index.ts)_

## `architect link:list`

List all linked components.

```
USAGE
  $ architect link:list

DESCRIPTION
  List all linked components.

EXAMPLES
  $ architect link:list
```

_See code: [src/commands/link/list.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/link/list.ts)_

## `architect login`

Login to the Architect Cloud platform

```
USAGE
  $ architect login [-e <value>] [-p <value>]

FLAGS
  -e, --email=<value>     Email
  -p, --password=<value>  Password

DESCRIPTION
  Login to the Architect Cloud platform

EXAMPLES
  $ architect login

  $ architect login -e my-email-address@my-email-domain.com
```

_See code: [src/commands/login.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/login.ts)_

## `architect logout`

Logout from the Architect registry

```
USAGE
  $ architect logout

DESCRIPTION
  Logout from the Architect registry

EXAMPLES
  $ architect logout
```

_See code: [src/commands/logout.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/logout.ts)_

## `architect logs [RESOURCE]`

Get logs from services both locally and remote

```
USAGE
  $ architect logs [RESOURCE] [-a <value>] [-e <value>] [-f <value>] [--since <value>] [--raw <value>]
    [--tail <value>] [--timestamps <value>] [-r <value>]

ARGUMENTS
  RESOURCE  Name of resource

FLAGS
  -a, --account=<value>      Architect account
  -e, --environment=<value>  Architect environment
  -f, --follow=<value>       Specify if the logs should be streamed.
  -r, --replica=<value>      Replica index for service. Only works on remote deploys.
  --raw=<value>              Show the raw output of the logs.
  --since=<value>            Only return logs newer than a relative duration like 5s, 2m, or 3h. Defaults to all logs.
                             Only one of since-time / since may be used.
  --tail=<value>             [default: -1] Lines of recent log file to display. Defaults to -1 with no selector, showing
                             all log lines otherwise 10, if a selector is provided.
  --timestamps=<value>       Include timestamps on each line in the log output.

DESCRIPTION
  Get logs from services both locally and remote

EXAMPLES
  $ architect logs

  $ architect logs --follow --raw --timestamps
```

_See code: [src/commands/logs.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/logs.ts)_

## `architect port-forward [RESOURCE] [FLAGS]`

Port forward service to localhost

```
USAGE
  $ architect port-forward [RESOURCE] [FLAGS]

ARGUMENTS
  RESOURCE  Name of resource

FLAGS
  -a, --account=<value>      Architect account
  -e, --environment=<value>  Architect environment
  -r, --replica=<value>      Replica index for service. Only works on remote deploys.
  --address=<value>          [default: localhost] Addresses to listen on. Only accepts IP addresses or localhost as a
                             value.
  --port=<value>             The port to listen on for the address provided.
  --target-port=<value>      The target port for the service.

DESCRIPTION
  Port forward service to localhost

EXAMPLES
  $ architect port-forward

  $ architect port-forward --account myaccount --environment myenvironment mycomponent.services.app

  $ architect port-forward --account myaccount --environment myenvironment mycomponent.services.app --replica 0

  $ architect port-forward --address 0.0.0.0 --port 8080
```

_See code: [src/commands/port-forward.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/port-forward.ts)_

## `architect register [COMPONENT]`

Register a new Component with Architect Cloud. Multiple components are accepted. If multiple components are specified, the same command arg(s) and flag(s) will be applied to each component.

```
USAGE
  $ architect register [COMPONENT] [-a <value>] [--arg <value>] [--architecture <value>] [--cache-directory
    <value>] [-t <value> | ]

ARGUMENTS
  COMPONENT  Path to the component(s) to register

FLAGS
  -a, --account=<value>      Architect account
  -t, --tag=<value>          [default: latest] Tag to give to the new component
  --architecture=<value>...  [default: amd64] Architecture(s) to target for Docker image builds
  --arg=<value>...           Build arg(s) to pass to docker build
  --cache-directory=<value>  Directory to write build cache to. Do not use in Github Actions:
                             https://docs.architect.io/deployments/automated-previews/#caching-between-workflow-runs

DESCRIPTION
  Register a new Component with Architect Cloud. Multiple components are accepted. If multiple components are specified,
  the same command arg(s) and flag(s) will be applied to each component.

ALIASES
  $ architect component:register
  $ architect components:register
  $ architect c:register
  $ architect comp:register

EXAMPLES
  $ architect register

  $ architect register -t latest

  $ architect register -a myaccount -t latest ./architect.yml ../myothercomponent/architect.yml

  $ architect register -a myaccount -t latest --arg NODE_ENV=dev ./architect.yml
```

_See code: [src/commands/register.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/register.ts)_

## `architect scale [SERVICE]`

Scale a service to a specified number of replicas.

```
USAGE
  $ architect scale [SERVICE] [-a <value>] [-e <value>] [--component <value>] [--tag <value>] [--replicas
    <value>] [--clear]

ARGUMENTS
  SERVICE  Name of service

FLAGS
  -a, --account=<value>      Architect account
  -e, --environment=<value>  Architect environment
  --clear                    Use to clear scaling settings for the specified service in the specified environment
  --component=<value>        Name of the component with the service to scale
  --replicas=<value>         Number of desired service replicas
  --tag=<value>              Tag of the component to scale

DESCRIPTION
  Scale a service to a specified number of replicas.

EXAMPLES
  $ architect scale api --component my-component --replicas 4

  $ architect scale api --component my-component --clear
```

_See code: [src/commands/scale.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/scale.ts)_

## `architect secrets:download SECRETS_FILE`

Download secrets from an account or an environment

```
USAGE
  $ architect secrets:download [SECRETS_FILE] [-a <value>] [-e <value>] [--cluster <value>]

ARGUMENTS
  SECRETS_FILE  Secrets filename to download secrets

FLAGS
  -a, --account=<value>      Architect account
  -e, --environment=<value>  Architect environment
  --cluster=<value>          Architect cluster

DESCRIPTION
  Download secrets from an account or an environment

ALIASES
  $ architect secrets
  $ architect secrets/get

EXAMPLES
  $ architect secrets --account=myaccount ./mysecrets.yml

  $ architect secrets --account=myaccount --cluster=mycluster ./mysecrets.yml

  $ architect secrets --account=myaccount --environment=myenvironment ./mysecrets.yml
```

_See code: [src/commands/secrets/download.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/secrets/download.ts)_

## `architect secrets:upload SECRETS_FILE`

Upload secrets from a file to an account or an environment

```
USAGE
  $ architect secrets:upload [SECRETS_FILE] [-a <value>] [-e <value>] [--cluster <value>] [--override <value>]

ARGUMENTS
  SECRETS_FILE  Secrets file to be uploaded

FLAGS
  -a, --account=<value>      Architect account
  -e, --environment=<value>  Architect environment
  --cluster=<value>          Architect cluster
  --override=<value>         Allow override of existing secrets

DESCRIPTION
  Upload secrets from a file to an account or an environment

ALIASES
  $ architect secrets:set

EXAMPLES
  $ architect secrets:set --account=myaccount ./mysecrets.yml

  $ architect secrets:set --account=myaccount --override ./mysecrets.yml

  $ architect secrets:set --account=myaccount --cluster=mycluster ./mysecrets.yml

  $ architect secrets:set --account=myaccount --cluster=mycluster --override ./mysecrets.yml

  $ architect secrets:set --account=myaccount --environment=myenvironment ./mysecrets.yml

  $ architect secrets:set --account=myaccount --environment=myenvironment --override ./mysecrets.yml
```

_See code: [src/commands/secrets/upload.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/secrets/upload.ts)_

## `architect task COMPONENT TASK`

Execute a task in the given environment

```
USAGE
  $ architect task [COMPONENT] [TASK] [-l <value> | -a <value>] [-o <value> |  | -e <value>]

ARGUMENTS
  COMPONENT  The name of the component that contains the task to execute
  TASK       The name of the task to execute

FLAGS
  -a, --account=<value>       Architect account
  -e, --environment=<value>   Architect environment
  -l, --local=<value>         Deploy the stack locally instead of via Architect Cloud
  -o, --compose-file=<value>  Path where the compose file should be written to

DESCRIPTION
  Execute a task in the given environment

ALIASES
  $ architect task:exec

EXAMPLES
  $ architect task --account=myaccount --environment=myenvironment mycomponent:latest mytask
```

_See code: [src/commands/task.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/task.ts)_

## `architect unlink [COMPONENTPATHORNAME]`

Unlink a component from the host by path or name

```
USAGE
  $ architect unlink [COMPONENTPATHORNAME] [--all <value>]

FLAGS
  --all=<value>  Unlink all components registered locally

DESCRIPTION
  Unlink a component from the host by path or name

EXAMPLES
  $ architect unlink

  $ architect unlink -p ../architect.yml

  $ architect unlink -p mycomponent
```

_See code: [src/commands/unlink.ts](https://github.com/architect-team/architect-cli/blob/v1.39.0-rc.7/src/commands/unlink.ts)_
<!-- commandsstop -->
