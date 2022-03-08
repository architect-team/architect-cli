---
title: Local environments
---

# Local environments

The first thing any developer wants to do when they're creating an app or service is run it locally. Architects open-source CLI was designed specifically to allow developers to write `architect.yml` files and provision the corresponding services on their own machine. Once you've [created an architect.yml file](/1-components/architect-yml.md), you can use the CLI to register the component locally and then deploy with ease.

## Local registration

One of the staple features of Architect, [dependency management](/1-components/4-dependencies.md), requires that components maintain a unique name by which they can be resolved. By default, the CLI will look for components by name in Architects cloud registry, but when developers are working locally they are unlikely to have published their work to the registry.

In order to help developers take advantage of dependency management during active development, Architects CLI includes the means of simulating Architects cloud registry right on your personal machine. We've taken inspiration from NPM to instrument a `link` command that will register a path on your local machine as the location for a component. Whenever the component is referenced by name, the CLI will then find it on your machine instead of having to call out to the registry.

```sh
$ architect link ./examples/react-app/
Successfully linked examples/react-app to local system at /architect-cli/examples/react-app.
```

## Local deployment

Once you've registered a component locally or remotely, that component can then be deployed with a single command:

```sh
$ architect dev examples/react-app:latest -i app:app -p world_text="dude"

Using locally linked examples/react-app found at /architect-cli/examples/react-app
http://app.arc.localhost:80/ => examples--react-app--app--latest--aklmrtvo

http://localhost:50000/ => examples--react-app--api-db--latest--arrm58dc
http://localhost:50001/ => examples--react-app--api--latest--1dzvo47x
http://localhost:50002/ => examples--react-app--app--latest--aklmrtvo
http://localhost:80/ => gateway
```

When running this command we are telling Architect to deploy the application to the local machine. Each component will run for the duration of the command. Whenever this commnad is used, the `debug` fields associated with each service will serve as override values for the service configuration.

The next portion of the command to call attention to is the reference to the component and tag, `examples/react-app:latest`. This refers to a component name and tag, and the CLI will first attempt to find it in the local registry before then trying to find it in the cloud registry. If the component is found locally, the CLI will inform you via the first line of the logs.

### Interface mapping

You may have also noticed the `-i` flag in the command. Much like `docker run` supports [port mapping](https://docs.docker.com/config/containers/container-networking/) so that ports don't conflict with each other, Architect supports interface mapping when deploying components to ensure that interface names from components don't conflict with each other in a shared environment:

```
-i <mapped-name>:<component-interface-name>
```

Interface mapping serves the added function of telling the environment which interfaces should be deemed "external". Interfaces deemed external will be made available via an automatically deployed API gateway. Each environment will be allocated a gateway so long as there is at least one interface mapped to a component.

### Setting parameter values

Finally, the `-p` flag in the dev command allows you to specify values for parameters defined by the component.

Additionally, environment variables found on the local machine prefixed with `ARC_` will be used to populate the parameter values of any components being deployed. For example, if we wanted to set the `world_text` parameter via environment parmeters, all we have to do is define a parameter named `ARC_world_text`:

```sh
$ ARC_world_text="dude"
$ architect dev examples/react-app:latest -i app:app
```

_In order to streamline local development, we recommend creating a single `.env` file checked into source control that includes a set of configuration options for developers to use when developing locally. They can easily mount the included parameters by running `source .env` before deploying._

### HSTS issues

Architect starts a load balancer for each local deployment to route traffic to your services over HTTP. Occasionally browsers such as Chrome will block requests to certain websites unless traffic is sent over HTTPS. If you attempt to navigate to a route exposed by your local deployment and see a message such as `You cannot visit app.arc.localhost right now because the website uses HSTS`, you will need to turn off HSTS for `localhost` on your browser. In Chrome, for example, that can be done by navigating to `chrome://net-internals/#hsts` and deleting the security policy for `localhost` and its subdomains.
