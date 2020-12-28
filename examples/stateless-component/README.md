<p align="center">
  <a href="//architect.io" target="blank"><img src="https://www.architect.io/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# Stateless Architect components

For apps and services that don't require their own databases or state, describing your service might seem easy ([click here to see how to describe ones that do](../stateful-components)). However, if you need to connect to peer API services you might find yourself annoyed at the complexity involved with networking, service discovery, network security, and more. Architects dependency resolver can help remediate that.

In this example, you'll see the code for a simple Next.js web application that connects back to the hello world example component as a dependency. All we have to do is specify the name and version of this component in the `dependencies` block of our [architect.yml](./architect.yml) in order to automatically provision the dependency. Once referenced, we can use Architects embedded [service discovery](https://www.architect.io/docs/configuration/dependencies#dependency-referencing-syntax) features to connect to it automatigically.

[Learn more about the architect.yml file](//docs.architect.io/configuration/architect-yml)

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/stateful-component

# Register the component to the local registry
$ architect link .

# Deploy using the --local flag
$ architect deploy --local examples/stateless-component:latest -i frontend:frontend
```

Once the deploy has completed, you can reach your new service by going to http://frontend.localhost/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! Just click the button below to deploy it to a sample Kubernetes cluster powered by Architect Cloud:

[![Deploy Button](https://www.architect.io/deploy-button.svg)](https://app.architect.io/examples/components/stateless-component/deploy?tag=latest&interface=frontend%3Afrontend)

Alternatively, if you're already familiar with Architect and have your own environment registered, you can use the command below instead:

```sh
$ architect deploy examples/stateless-component:latest -a <account-name> -e <environment-name> -i frontend:frontend
```


