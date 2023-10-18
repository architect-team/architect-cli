---
title: architect.yml
---

# architect.yml

This document describes the full specification of the [architect.yml](https://docs.architect.io/components/architect-yml) configuration file. The top level of your `architect.yml` should be a [ComponentSpec](#componentspec).

We've published a formal definition of this specification here: [Architect JSONSchema](https://raw.githubusercontent.com/architect-team/architect-cli/main/src/dependency-manager/schema/architect.schema.json).

<Card
  title="For users of Visual Studio Code, check out the Architect extension!"
  href="https://marketplace.visualstudio.com/items?itemName=Architectio.architect-vscode"
/>

If you're using an IDE with intellisense backed by [SchemaStore](https://www.schemastore.org/json/), then you may already see syntax highlighting when editing any file named `architect.yml`.

**Note**: all references to the `Dict<T>` type below refer to a key-value map where the keys are strings and the values are of type T.

## ComponentSpec

The top level object of the `architect.yml`; defines a deployable Architect Component.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `name`* | string | Globally unique friendly reference to the component. must contain only lower alphanumeric and single hyphens in the middle; max length 32 | Must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3A(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%5C%2F)%3F(%3F%3Ccomponent_name%3E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-))(%3F%3A%40(%3F%3Cinstance_name%3E%5B%5Cw%5D%5B%5Cw%5C.-%5D%7B0%2C127%7D))%3F%24">Regex</a> |
 | `description` | string | A human-readable description of the component. This will be rendered when potential consumers view the component so that they know what it should be used for. |  |
 | `keywords` | Array&lt;string&gt; | Additional search terms to be used when the component is indexed so that others can find it more easily. |  |
 | `author` | string | The name or handle of the author of the component as a developer contact. |  |
 | `homepage` | string | The url that serves as the informational homepage of the component (i.e. a github repo). |  |
 | `secrets` | Dict&lt;string&gt; | A map of named, configurable fields for the component. If a component contains properties that differ across environments (i.e. environment variables), you'll want to capture them as secrets. Specifying a primitive value here will set the default secret value. For more detailed configuration, specify a SecretDefinitionSpec | <a target="_blank" href="https://regexr.com/?expression=%5E%5Ba-zA-Z0-9_-%5D%2B%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `outputs` | Dict&lt;string&gt; | A map of named, configurable outputs for the component. Outputs allow components to expose configuration details that should be shared with consumers, like API keys or notification topic names. | <a target="_blank" href="https://regexr.com/?expression=%5E%5Ba-zA-Z0-9_-%5D%2B%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `databases` | Dict&lt;string&gt; | A database represents a stateful service powered by one of several supported database engines. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `services` | Dict&lt;string&gt; | A Service represents a non-exiting runtime (e.g. daemons, servers, etc.). Each service is independently deployable and scalable. Services are 1:1 with a docker image. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `tasks` | Dict&lt;string&gt; | A set of named recurring and/or exiting runtimes (e.g. crons, schedulers, triggered jobs) included with the component. Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are 1:1 with a docker image. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `dependencies` | Dict&lt;string&gt; | A key-value set of dependencies with an empty value. Reference each dependency by component name (e.g. `cloud: {}`) | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3A(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%5C%2F)%3F(%3F%3Ccomponent_name%3E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-))(%3F%3A%40(%3F%3Cinstance_name%3E%5B%5Cw%5D%5B%5Cw%5C.-%5D%7B0%2C127%7D))%3F%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | ~~`interfaces`~~ | Dict&lt;string&gt; | A set of named gateways that broker access to the services inside the component. All network traffic within a component is locked down to the component itself, unless included in this interfaces block. An interface represents a front-door to your component, granting access to upstream callers. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>, Deprecated |
 | ~~`artifact_image`~~ | string | - | Deprecated |


## ServiceSpec

A runtimes (e.g. daemons, servers, etc.). Each service is independently deployable and scalable. Services are 1:1 with a docker image.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `enabled` | boolean | Determines if the service should be running. | default: `true` |
 | `debug` | Partial&lt;[ServiceSpec](#servicespec)&gt; | A partial object that is deep-merged into the spec on local deployments. Useful to mount developer volumes or set other local-development configuration. Think of this as a "local override" block. |  |
 | `interfaces` | Dict&lt;string&gt; | A set of named interfaces to expose service functionality over the network to other services within the same component. A `string` or `number` represents the TCP port that the service is listening on. For more detailed configuration, specify a full `ServiceInterfaceSpec` object. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `liveness_probe` | [LivenessProbeSpec](#livenessprobespec) |  |  |
 | `volumes` | Dict&lt;string&gt; | A set of named volumes to be mounted at deploy-time. Take advantage of volumes to store data that should be shared between running containers or that should persist beyond the lifetime of a container. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `replicas` | integer \| [Expression](https://docs.architect.io/reference/contexts) | A static number of replicas of a service to be deployed. For scaling configuration, see `scaling` field. |  |
 | `scaling` | [ScalingSpec](#scalingspec) |  |  |
 | `deploy` | [DeploySpec](#deployspec) |  |  |
 | `termination_grace_period` | string \| [Expression](https://docs.architect.io/reference/contexts) | A period of time between a service being passed a SIGINT and a SIGTERM when it's scheduled to be replaced or terminated. Only used for remote deployments. | default: `30s` |
 | `description` | string | Human readable description |  |
 | `image` | string \| [Expression](https://docs.architect.io/reference/contexts) | The docker image that serves as the unit of runtime. This field is disjunctive with `build` (only one of `image` or `build` can be set) |  |
 | `command` | Array&lt;string&gt; \| string \| [Expression](https://docs.architect.io/reference/contexts) | The docker startup command. Use this if you need to override or parameterize or parameterize the docker image command. |  |
 | `entrypoint` | Array&lt;string&gt; \| string \| [Expression](https://docs.architect.io/reference/contexts) | The docker entrypoint for the container. Use this if you need to override or parameterize the docker image entrypoint. |  |
 | `language` | string | The dominant programming language used; this is for informational purposes only. |  |
 | `environment` | Dict&lt;string&gt; | A set of key-value pairs or secret definitions that describes environment variables and their values. | <a target="_blank" href="https://regexr.com/?expression=%5E%5Ba-zA-Z0-9_%5D%2B%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>, [More](https://docs.architect.io/components/services/#local-configuration) |
 | `build` | [BuildSpec](#buildspec) |  |  |
 | `cpu` | number \| [Expression](https://docs.architect.io/reference/contexts) | The cpu required to run a service or a task | [More](https://docs.architect.io/components/services/#cpu--memory) |
 | `memory` | string \| [Expression](https://docs.architect.io/reference/contexts) | The memory required to run a service or a task. | [More](https://docs.architect.io/components/services/#cpu--memory) |
 | `depends_on` | Array&lt;string&gt; | An array of service names for those services in the component that are pre-requisites to deploy. Used at deploy-time to build a deploy order across services and tasks. |  |
 | `labels` | Dict&lt;string&gt; | A simple key-value annotation store; useful to organize, categorize, scope, and select services and tasks. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D(.%7B1%2C63%7D%2F)%3F.%7B1%2C63%7D%24)(((%5Ba-z0-9%5D%5B-a-z0-9_.%5D*)%3F%5Ba-z0-9%5D)%3F%2F)%3F((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>, [More](https://docs.architect.io/components/services/#labels) |
 | `reserved_name` | string | A specific service name which will override the service name specified in the component. | Must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">Regex</a> |


## SecretDefinitionSpec

Components can define configurable secrets that can be used to enrich the contained services with environment-specific information (i.e. environment variables).

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `required` | boolean | Denotes whether the secret is required. |  |
 | `description` | string | A human-friendly description of the secret. |  |
 | `default` | Array&lt;any&gt; \| boolean \| number \| object \| string \| null \| [Expression](https://docs.architect.io/reference/contexts) | Sets a default value for the secret if one is not provided |  |


## ComponentInterfaceSpec

Component Interfaces are the primary means by which components advertise their resolvable addresses to others. Interfaces are the only means by which other components can communicate with your component.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `ingress` | [IngressSpec](#ingressspec) |  |  |
 | `description` | string | A human-readable description of the component. This will be rendered when potential consumers view the interface so that they know what it should be used for. |  |
 | `host` | string | The host that the component interface should forward to. |  |
 | `port` | number \| [Expression](https://docs.architect.io/reference/contexts) | The port that the component interface should forward to. |  |
 | `protocol` | string \| [Expression](https://docs.architect.io/reference/contexts) | The protocol by which the component interface can be connected to. |  |
 | `username` | string \| [Expression](https://docs.architect.io/reference/contexts) | The Basic Auth username by which a component interface can be connected to. |  |
 | `password` | string \| [Expression](https://docs.architect.io/reference/contexts) | The Basic Auth password by which a component interface can be connected to. |  |
 | `url`* | string \| [Expression](https://docs.architect.io/reference/contexts) | The url that the component interface should forward to. |  |
 | `sticky` | boolean \| [Expression](https://docs.architect.io/reference/contexts) | If this interface is made into an external ingress, sticky=true will denote the gateway should use sticky sessions if more than one replica is running. |  |


## TaskSpec

A Task represents a recurring and/or exiting runtime (e.g. crons, schedulers, triggered jobs). Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are 1:1 with a docker image.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `debug` | Partial&lt;[TaskSpec](#taskspec)&gt; | A partial object that is deep-merged into the spec on local deployments. Useful to mount developer volumes or set other local-development configuration. Think of this as a "local override" block. |  |
 | `schedule` | string \| [Expression](https://docs.architect.io/reference/contexts) | A cron expression by which this task will be scheduled. Leave blank to deploy a task that never runs unless triggered from the CLI. |  |
 | `description` | string | Human readable description |  |
 | `image` | string \| [Expression](https://docs.architect.io/reference/contexts) | The docker image that serves as the unit of runtime. This field is disjunctive with `build` (only one of `image` or `build` can be set) |  |
 | `command` | Array&lt;string&gt; \| string \| [Expression](https://docs.architect.io/reference/contexts) | The docker startup command. Use this if you need to override or parameterize or parameterize the docker image command. |  |
 | `entrypoint` | Array&lt;string&gt; \| string \| [Expression](https://docs.architect.io/reference/contexts) | The docker entrypoint for the container. Use this if you need to override or parameterize the docker image entrypoint. |  |
 | `language` | string | The dominant programming language used; this is for informational purposes only. |  |
 | `environment` | Dict&lt;string&gt; | A set of key-value pairs or secret definitions that describes environment variables and their values. | <a target="_blank" href="https://regexr.com/?expression=%5E%5Ba-zA-Z0-9_%5D%2B%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>, [More](https://docs.architect.io/components/services/#local-configuration) |
 | `build` | [BuildSpec](#buildspec) |  |  |
 | `cpu` | number \| [Expression](https://docs.architect.io/reference/contexts) | The cpu required to run a service or a task | [More](https://docs.architect.io/components/services/#cpu--memory) |
 | `memory` | string \| [Expression](https://docs.architect.io/reference/contexts) | The memory required to run a service or a task. | [More](https://docs.architect.io/components/services/#cpu--memory) |
 | `depends_on` | Array&lt;string&gt; | An array of service names for those services in the component that are pre-requisites to deploy. Used at deploy-time to build a deploy order across services and tasks. |  |
 | `labels` | Dict&lt;string&gt; | A simple key-value annotation store; useful to organize, categorize, scope, and select services and tasks. | <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D(.%7B1%2C63%7D%2F)%3F.%7B1%2C63%7D%24)(((%5Ba-z0-9%5D%5B-a-z0-9_.%5D*)%3F%5Ba-z0-9%5D)%3F%2F)%3F((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>, [More](https://docs.architect.io/components/services/#labels) |
 | `reserved_name` | string | A specific service name which will override the service name specified in the component. | Must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F!-)(%3F!.%7B0%2C32%7D--)%5Ba-z0-9-%5D%7B1%2C32%7D(%3F%3C!-)%24">Regex</a> |


## DatabaseSpec

Component databases let you quickly spin up a database for your service

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `description` | string | Human readable description |  |
 | `type`* | string \| [Expression](https://docs.architect.io/reference/contexts) | The type engine and version of database software needed for data storage. |  |
 | `connection_string` | string \| null \| [Expression](https://docs.architect.io/reference/contexts) | The connection uri of an existing database to use instead of provisioning a new one |  |


## LivenessProbeSpec

Configuration for service health checks. Architect uses health checks are used for load balancing and rolling updates.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `success_threshold` | number \| [Expression](https://docs.architect.io/reference/contexts) | The number of times to retry a health check before the container is considered healthy. | default: `1` |
 | `failure_threshold` | number \| [Expression](https://docs.architect.io/reference/contexts) | The number of times to retry a failed health check before the container is considered unhealthy. | default: `3` |
 | `timeout` | string \| [Expression](https://docs.architect.io/reference/contexts) | The time period to wait for a health check to succeed before it is considered a failure. You may specify any value between: 2s and 60s | default: `5s` |
 | `interval` | string \| [Expression](https://docs.architect.io/reference/contexts) | The time period in seconds between each health check execution. You may specify any value between: 5s and 300s | default: `30s` |
 | `initial_delay` | string \| [Expression](https://docs.architect.io/reference/contexts) | Delays the check from running for the specified amount of time | default: `0s` |
 | ~~`path`~~ | string \| [Expression](https://docs.architect.io/reference/contexts) | [Deprecated: use `command` instead.] Path for the http check executable. Path should be absolute (e.g. /health). If `path` is set, `port` also must be set. This field is disjunctive with `command` (only one of `path` or `command` can be set). | Deprecated |
 | `command` | Array&lt;string&gt; \| string | Command that runs the http check. This field is disjunctive with `path` and `port` (only one of `command` or `path`/`port` can be set). |  |
 | ~~`port`~~ | number \| [Expression](https://docs.architect.io/reference/contexts) | [Deprecated: use `command` instead.] Port that the http check will run against. If `port` is set, `path` also must be set. This field is disjunctive with `command` (only one of `port` or `command` can be set). | Deprecated |


## VolumeSpec

Architect can mount volumes onto your services and tasks to store data that should be shared between running containers or that should persist beyond the lifetime of a container.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `mount_path` | string \| [Expression](https://docs.architect.io/reference/contexts) | Directory at which the volume will be mounted inside the container. |  |
 | `host_path` | string \| [Expression](https://docs.architect.io/reference/contexts) | A directory on the host machine to sync with the mount_path on the docker image. This field is only relevant inside the debug block for local deployments. This field is disjunctive with `key` (only one of `host_path` or `key` can be set). |  |
 | `key` | string \| [Expression](https://docs.architect.io/reference/contexts) | A reference to the underlying volume on the deployment cluster of choice. The `docker-compose` volume name, the name of the Kubernetes PersistentVolumeClaim, or the EFS ID of an AWS volume. This field is disjunctive with `host_path` (only one of `key` or `host_path` can be set). | [More](https://docs.architect.io/components/services/#volumes) |
 | `description` | string | Human-readable description of volume |  |
 | `readonly` | boolean \| [Expression](https://docs.architect.io/reference/contexts) | Marks the volume as readonly. |  |


## BuildSpec

An object containing the details necessary for Architect to build the service via Docker. Whenever a service that specifies a build field is registered with Architect, the CLI will trigger a docker build and replace the build field with a resolvable image.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `context` | string \| [Expression](https://docs.architect.io/reference/contexts) | The path to the directory containing the source code relative to the `architect.yml` file. |  |
 | `buildpack` | boolean | Option to use buildpack to build an image. |  |
 | `args` | Dict&lt;string&gt; | Build args to be passed into `docker build`. | <a target="_blank" href="https://regexr.com/?expression=%5E%5Ba-zA-Z0-9_%5D%2B%24">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=undefined">ValueRegex</a>,  |
 | `dockerfile` | string \| [Expression](https://docs.architect.io/reference/contexts) | The path to the Dockerfile relative to the `build.context` | default: `Dockerfile` |
 | `target` | string \| [Expression](https://docs.architect.io/reference/contexts) | The stage to build in the Dockerfile |  |


## IngressTlsSpec

Configuration for custom certificate.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `crt`* | string \| [Expression](https://docs.architect.io/reference/contexts) | Custom certificate. |  |
 | `key`* | string \| [Expression](https://docs.architect.io/reference/contexts) | Custom certificate key. |  |
 | `ca` | string \| [Expression](https://docs.architect.io/reference/contexts) | Custom certificate ca. |  |


## IngressSpec

An ingress exposes an interface to external network traffic through an architect-deployed gateway.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `enabled` | boolean | Marks the interface as an ingress. |  |
 | `subdomain` | string \| [Expression](https://docs.architect.io/reference/contexts) | The subdomain that will be used if the interface is exposed externally. Use `subdomain: @` to target the base domain. |  |
 | `tls` | [IngressTlsSpec](#ingresstlsspec) |  |  |
 | `path` | string \| [Expression](https://docs.architect.io/reference/contexts) | The path of the interface used for path based routing |  |
 | `ip_whitelist` | Array&lt;string \| string&gt; \| string | IP addresses that are allowed to access the interface |  |
 | `private` | boolean \| [Expression](https://docs.architect.io/reference/contexts) | Marks the ingress as private behind Architect authentication |  |


## ScalingMetricsSpec

Scaling metrics define the upper bound of resource consumption before spinning up an additional replica.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `cpu` | integer \| [Expression](https://docs.architect.io/reference/contexts) | The cpu usage required to trigger scaling. | [More](https://docs.architect.io/components/services/#cpu--memory) |
 | `memory` | integer \| [Expression](https://docs.architect.io/reference/contexts) | The memory usage required to trigger scaling. | [More](https://docs.architect.io/components/services/#cpu--memory) |


## ScalingSpec

Configuration that dictates the scaling behavior of a service.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `min_replicas`* | integer \| [Expression](https://docs.architect.io/reference/contexts) | The target minimum number of service replicas. |  |
 | `max_replicas`* | integer \| [Expression](https://docs.architect.io/reference/contexts) | The target maximum number of service replicas. |  |
 | `metrics`* | [ScalingMetricsSpec](#scalingmetricsspec) |  |  |


## KubernetesDeploySpec

Configuration that dictates the kubernetes deploy overrides.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `deployment`* |  |  |  |


## DeploySpec

Configuration that dictates the deploy overrides.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `kubernetes`* | [KubernetesDeploySpec](#kubernetesdeployspec) |  |  |


## ServiceInterfaceSpec

A service interface exposes service functionality over the network to other services within the same component. If you would like to expose services on the network to external components, see the ComponentInterfaceSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `description` | string \| [Expression](https://docs.architect.io/reference/contexts) | A human-readable description of the interface. |  |
 | `host` | null \| string \| [Expression](https://docs.architect.io/reference/contexts) | The host address of an existing service to use instead of provisioning a new one. Setting this field effectively overrides any deployment of this service and directs all traffic to the given host. |  |
 | `port`* | number \| [Expression](https://docs.architect.io/reference/contexts) | Port on which the service is listening for traffic. |  |
 | `protocol` | string \| [Expression](https://docs.architect.io/reference/contexts) | Protocol that the interface responds to | default: `http` |
 | `username` | null \| string \| [Expression](https://docs.architect.io/reference/contexts) | A Basic Auth username required to access the interface |  |
 | `password` | null \| string \| [Expression](https://docs.architect.io/reference/contexts) | A Basic Auth password required to access the interface |  |
 | `path` | string \| [Expression](https://docs.architect.io/reference/contexts) | The path of the interface |  |
 | `url` | string \| [Expression](https://docs.architect.io/reference/contexts) | The url of an existing service to use instead of provisioning a new one. Setting this field effectively overrides any deployment of this service and directs all traffic to the given url. |  |
 | `sticky` | boolean \| [Expression](https://docs.architect.io/reference/contexts) | Denotes that if this interface is made external, the gateway should use sticky sessions |  |
 | `ingress` | [IngressSpec](#ingressspec) |  |  |


## DependencySpec

An empty object that optionally supports specifying a tag for backwards compatibility.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `tag` | string \| [Expression](https://docs.architect.io/reference/contexts) |  |  |


## OutputDefinitionSpec

Components can define output fields that can be used to share configuration with consuming components.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
 | `description` | string | A human-friendly description of the output field. |  |
 | `value`* |  | Value of the output to be passed to upstream consumers |  |


