<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.architect.io/logo/horizontal-inverted.png">
    <source media="(prefers-color-scheme: light)" srcset="https://cdn.architect.io/logo/horizontal.png">
    <img width="320" alt="Architect Logo" src="https://cdn.architect.io/logo/horizontal.png">
  </picture>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# GCP Pubsub example

With event-driven architectures, applications are dependent on both the component publishing a topic they need to consume as well as the broker facilitating the request. The subscriber component has a dependency on the GCP pub/sub component as well as the publisher component, so that means we can simply deploy the subscriber to see the whole stack materialize.

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/gcp-pubsub

# Register the dependent components to the local registry
$ architect link ./publisher/architect.yml
$ architect link ./pubsub/architect.yml

# Deploy using the dev command
$ architect dev ./subscriber/architect.yml
```

Once the deploy has completed, you can reach your new service by going to https://pubsub.localhost.architect.sh/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the commands below to deploy the components to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect register ./publisher/architect.yml
$ architect register ./pubsub/architect.yml

$ architect deploy ./subscriber/architect.yml -e example-environment
```
