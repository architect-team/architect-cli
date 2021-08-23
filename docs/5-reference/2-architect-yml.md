---
title: architect.yml
---
# architect.yml

This document describes the full specification of the [architect.yml](/docs/configuration/architect-yml) configuration file. The top level of your `architect.yml` should be a [ComponentSpec](#componentspec).

We've published a formal definition of this specification here: [Architect JSONSchema](https://raw.githubusercontent.com/architect-team/architect-cli/master/src/dependency-manager/schema/architect.schema.json).

If you're using VS Code (or any other IDE with intellisense backed by [SchemaStore](https://www.schemastore.org/json/)), then you should already see syntax highlighting when editing any file named `architect.yml`.

Note that each reference to a `Dict<T>` type refers to a key-value object where the keys are strings and the values are of type T.

## ComponentSpec

The top level object of the architect.yml; defines a deployable Architect Component.

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`name`* | string | Globally unique friendly reference to the component. Must only include letters, numbers, and dashes. Must be prefixed with a valid account name (e.g. architect/component-name). | Must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D.%7B1%2C32%7D(%5C%2F%7C%3A%7C%24))%5Ba-z0-9%5D%2B(%3F%3A-%5Ba-z0-9%5D%2B)*%5C%2F(%3F%3D.%7B1%2C32%7D(%5C%2F%7C%3A%7C%24))%5Ba-z0-9%5D%2B(%3F%3A-%5Ba-z0-9%5D%2B)*(%3F%3A%40%5B%5Cw%5D%5B%5Cw%5C.-%5D%7B0%2C127%7D)%3F%24">Regex</a> | 
|`description` | string | A human-readable description of the component. This will be rendered when potential consumers view the component so that they know what it should be used for. |  | 
|`keywords` | Array&lt;string&gt; | Additional search terms to be used when the component is indexed so that others can find it more easily. |  | 
|`author` | string | The name or handle of the author of the component as a developer contact. |  | 
|`homepage` | string | The url that serves as the informational homepage of the component (i.e. a github repo). |  | 
|`parameters` | Dict&lt;string \| number \| boolean \| [ParameterDefinitionSpec](#parameterdefinitionspec) \| null&gt; | A map of named, configurable fields for the component. If a component contains properties that differ across environments (i.e. environment variables), you'll want to capture them as parameters. |  | 
|`services` | Dict&lt;[ServiceSpec](#servicespec)&gt; | A map of named runtimes (e.g. daemons, servers, etc.) included with the component. Each service is independently deployable and scalable. Services are generally 1:1 with a docker image. |  | 
|`tasks` | Dict&lt;[TaskSpec](#taskspec)&gt; | A map of named recurring runtimes (e.g. crons, schedulers, triggered jobs) included with the component. Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are generally 1:1 with a docker image. |  | 
|`dependencies` | Dict&lt;string&gt; | A key-value store of dependencies and their respective tags. Reference each dependency by component name (e.g. `architect/cloud: latest`) |  | 
|`interfaces` | Dict&lt;string \| [ComponentInterfaceSpec](#componentinterfacespec)&gt; | A map of named gateways that broker access to the services inside the component. All network traffic within a component is locked down to the component itself, unless included in this interfaces block. An interface represents a front-door to your component, granting access to upstream callers. |  | 
|~~`artifact_image`~~ | string |  |  Deprecated  | 


## ServiceSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`debug` | Partial&lt;[ServiceSpec](#servicespec)&gt; |  |  | 
|`interfaces` | Dict&lt;[ServiceInterfaceSpec](#serviceinterfacespec) \| string \| number&gt; |  |  | 
|`liveness_probe` | [LivenessProbeSpec](#livenessprobespec) |  |  | 
|`replicas` | number \| string |  |  | 
|`scaling` | [ScalingSpec](#scalingspec) |  |  | 
|`description` | string |  |  | 
|`image` | string |  |  | 
|`command` | Array&lt;string&gt; \| string |  |  | 
|`entrypoint` | Array&lt;string&gt; \| string |  |  | 
|`language` | string |  |  | 
|`environment` | Dict&lt;boolean \| null \| number \| string&gt; |  |  | 
|`volumes` | Dict&lt;[VolumeSpec](#volumespec) \| string&gt; |  |  | 
|`build` | [BuildSpec](#buildspec) |  |  | 
|`cpu` | number \| string |  |  | 
|`memory` | string |  |  | 
|`deploy` | [DeploySpec](#deployspec) |  |  | 
|`depends_on` | Array&lt;string&gt; |  |  | 
|`labels` | Dict&lt;string&gt; |  | Key must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D(.%7B1%2C63%7D%2F)%3F.%7B1%2C63%7D%24)(((%5Ba-z0-9%5D%5B-a-z0-9_.%5D*)%3F%5Ba-z0-9%5D)%3F%2F)%3F((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a>Value must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D.%7B1%2C63%7D)((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a> | 


## TaskSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`debug` | Partial&lt;[TaskSpec](#taskspec)&gt; |  |  | 
|`schedule` | string |  |  | 
|`description` | string |  |  | 
|`image` | string |  |  | 
|`command` | Array&lt;string&gt; \| string |  |  | 
|`entrypoint` | Array&lt;string&gt; \| string |  |  | 
|`language` | string |  |  | 
|`environment` | Dict&lt;boolean \| null \| number \| string&gt; |  |  | 
|`volumes` | Dict&lt;[VolumeSpec](#volumespec) \| string&gt; |  |  | 
|`build` | [BuildSpec](#buildspec) |  |  | 
|`cpu` | number \| string |  |  | 
|`memory` | string |  |  | 
|`deploy` | [DeploySpec](#deployspec) |  |  | 
|`depends_on` | Array&lt;string&gt; |  |  | 
|`labels` | Dict&lt;string&gt; |  | Key must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D(.%7B1%2C63%7D%2F)%3F.%7B1%2C63%7D%24)(((%5Ba-z0-9%5D%5B-a-z0-9_.%5D*)%3F%5Ba-z0-9%5D)%3F%2F)%3F((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a>Value must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D.%7B1%2C63%7D)((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a> | 


## ComponentInterfaceSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`ingress` | [IngressSpec](#ingressspec) |  |  | 
|`description` | string |  |  | 
|`host` | string |  |  | 
|`port` | number \| string |  |  | 
|`protocol` | string |  |  | 
|`username` | string |  |  | 
|`password` | string |  |  | 
|`url`* | string |  |  | 
|`sticky` | boolean \| string |  |  | 


## ParameterDefinitionSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`required` | boolean |  |  | 
|`description` | string |  |  | 
|`default` | boolean \| number \| string \| null |  |  | 


## DeployModuleSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`path`* | string |  |  | 
|`inputs`* | Dict&lt;string \| null&gt; |  |  | 


## DeploySpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`strategy`* | string |  |  | 
|`modules`* | Dict&lt;[DeployModuleSpec](#deploymodulespec)&gt; |  |  | 


## VolumeSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`mount_path` | string |  |  | 
|`host_path` | string |  |  | 
|`key` | string |  |  | 
|`description` | string |  |  | 
|`readonly` | boolean \| string |  |  | 


## BuildSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`context` | string |  |  | 
|`args` | Dict&lt;string \| null&gt; |  |  | 
|`dockerfile` | string |  |  | 


## ScalingMetricsSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`cpu` | number \| string |  |  | 
|`memory` | string |  |  | 


## ScalingSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`min_replicas`* | number \| string |  |  | 
|`max_replicas`* | number \| string |  |  | 
|`metrics`* | [ScalingMetricsSpec](#scalingmetricsspec) |  |  | 


## ServiceInterfaceSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`description` | string |  |  | 
|`host` | null \| string |  |  | 
|`port` | number \| string |  |  | 
|`protocol` | string |  |  | 
|`username` | null \| string |  |  | 
|`password` | null \| string |  |  | 
|`url` | string |  |  | 
|`sticky` | boolean \| string |  |  | 


## LivenessProbeSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`success_threshold` | number \| string |  |  | 
|`failure_threshold` | number \| string |  |  | 
|`timeout` | string |  |  | 
|`interval` | string |  |  | 
|`initial_delay` | string |  |  | 
|`path` | string |  | Must match: <a target="_blank" href="https://regexr.com/?expression=%5E%5C%2F.*%24">Regex</a> | 
|`command` | Array&lt;string&gt; \| string |  |  | 
|`port`* | number \| string |  |  | 


## IngressSpec

| Field  (*=required)  | Type       | Description    | Misc           |
| -------------------- | ---------- | -------------- | -------------- |
|`enabled` | boolean |  |  | 
|`subdomain` | string |  |  | 



