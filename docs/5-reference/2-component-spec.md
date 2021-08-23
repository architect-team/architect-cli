---
title: architect.yml
---

# architect.yml

## ComponentSpec

### name*

**required**

string

Globally unique friendly reference to the component. Must only include letters, numbers, and dashes. Must be prefixed with a valid account name (e.g. architect/component-name).

Must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D.%7B1%2C32%7D(%5C%2F%7C%3A%7C%24))%5Ba-z0-9%5D%2B(%3F%3A-%5Ba-z0-9%5D%2B)*%5C%2F(%3F%3D.%7B1%2C32%7D(%5C%2F%7C%3A%7C%24))%5Ba-z0-9%5D%2B(%3F%3A-%5Ba-z0-9%5D%2B)*(%3F%3A%40%5B%5Cw%5D%5B%5Cw%5C.-%5D%7B0%2C127%7D)%3F%24">Regex</a>

### description

string

### keywords

Array&lt;string&gt;

### author

string

### homepage

string

### parameters

Map&lt;string, string | number | boolean | <a href="#parameterdefinitionspec">ParameterDefinitionSpec</a> | null&gt;

### services

Map&lt;string, <a href="#servicespec">ServiceSpec</a>&gt;

### tasks

Map&lt;string, <a href="#taskspec">TaskSpec</a>&gt;

### dependencies

Map&lt;string, string&gt;

### interfaces

Map&lt;string, string | <a href="#componentinterfacespec">ComponentInterfaceSpec</a>&gt;

### artifact_image

string


## ServiceSpec

### debug

Partial&lt;<a href="#servicespec">ServiceSpec</a>&gt;

### interfaces

Map&lt;string, <a href="#serviceinterfacespec">ServiceInterfaceSpec</a> | string | number&gt;

### liveness_probe

<a href="#livenessprobespec">LivenessProbeSpec</a>

### replicas

number | string

### scaling

<a href="#scalingspec">ScalingSpec</a>

### description

string

### image

string

### command

Array&lt;string&gt; | string

### entrypoint

Array&lt;string&gt; | string

### language

string

### environment

Map&lt;string, boolean | null | number | string&gt;

### volumes

Map&lt;string, <a href="#volumespec">VolumeSpec</a> | string&gt;

### build

<a href="#buildspec">BuildSpec</a>

### cpu

number | string

### memory

string

### deploy

<a href="#deployspec">DeploySpec</a>

### depends_on

Array&lt;string&gt;

### labels

Map<string, string>

Key must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D(.%7B1%2C63%7D%2F)%3F.%7B1%2C63%7D%24)(((%5Ba-z0-9%5D%5B-a-z0-9_.%5D*)%3F%5Ba-z0-9%5D)%3F%2F)%3F((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a>

Value must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D.%7B1%2C63%7D)((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a>


## TaskSpec

### debug

Partial&lt;<a href="#taskspec">TaskSpec</a>&gt;

### schedule

string

### description

string

### image

string

### command

Array&lt;string&gt; | string

### entrypoint

Array&lt;string&gt; | string

### language

string

### environment

Map&lt;string, boolean | null | number | string&gt;

### volumes

Map&lt;string, <a href="#volumespec">VolumeSpec</a> | string&gt;

### build

<a href="#buildspec">BuildSpec</a>

### cpu

number | string

### memory

string

### deploy

<a href="#deployspec">DeploySpec</a>

### depends_on

Array&lt;string&gt;

### labels

Map<string, string>

Key must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D(.%7B1%2C63%7D%2F)%3F.%7B1%2C63%7D%24)(((%5Ba-z0-9%5D%5B-a-z0-9_.%5D*)%3F%5Ba-z0-9%5D)%3F%2F)%3F((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a>

Value must match: <a target="_blank" href="https://regexr.com/?expression=%5E(%3F%3D.%7B1%2C63%7D)((%5BA-Za-z0-9%5D%5B-A-Za-z0-9_.%5D*)%3F%5BA-Za-z0-9%5D)%3F%24">Regex</a>


## ComponentInterfaceSpec

### ingress

<a href="#ingressspec">IngressSpec</a>

### description

string

### host

string

### port

number | string

### protocol

string

### username

string

### password

string

### url*

**required**

string

### sticky

boolean | string


## ParameterDefinitionSpec

### required

boolean

### description

string

### default

boolean | number | string | null


## DeployModuleSpec

### path*

**required**

string

### inputs*

**required**

Map&lt;string, string | null&gt;


## DeploySpec

### strategy*

**required**

string

### modules*

**required**

Map&lt;string, <a href="#deploymodulespec">DeployModuleSpec</a>&gt;


## VolumeSpec

### mount_path

string

### host_path

string

### key

string

### description

string

### readonly

boolean | string


## BuildSpec

### context

string

### args

Map&lt;string, string | null&gt;

### dockerfile

string


## ScalingMetricsSpec

### cpu

number | string

### memory

string


## ScalingSpec

### min_replicas*

**required**

number | string

### max_replicas*

**required**

number | string

### metrics*

**required**

<a href="#scalingmetricsspec">ScalingMetricsSpec</a>


## ServiceInterfaceSpec

### description

string

### host

null | string

### port

number | string

### protocol

string

### username

null | string

### password

null | string

### url

string

### sticky

boolean | string


## LivenessProbeSpec

### success_threshold

number | string

### failure_threshold

number | string

### timeout

string

### interval

string

### initial_delay

string

### path

string

Must match: <a target="_blank" href="https://regexr.com/?expression=%5E%5C%2F.*%24">Regex</a>

### command

Array&lt;string&gt; | string

### port*

**required**

number | string


## IngressSpec

### enabled

boolean

### subdomain

string


