<p align="center">
  <a href="//architect.io" target="blank"><img src="https://docs.architect.io/img/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# Live reloading code changes

Its extremely tedious to have to rebuilt container images every time code changes occur. This problem explodes exponentially when dealing with connected services and components with dependencies. That's why its important to configure your components with `debug` features (e.g. features that execute only when running locally) that allow your containers to update automatically whenever code changes are detected.

The component in this example project describes only a single service, `api`, that builds and deploys the source code located in this directory. Inside the `architect.yml` file, you'll see that this service has a `debug` block that specifies a different `command` to run, `npm run dev`, which uses [nodemon](https://nodemon.io/) to auto-detect code changes and dynamically restart our web server. Unfortunately, our code changes won't sync with the built container by default, but this can be solved easily by creating a volume that maps our host directory with the container operating system.

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/hot-reloading

# Deploy using the dev command
$ architect dev ./architect.yml
```

Once the deploy has completed, you can reach your new service by going to https://api.localhost.architect.sh/. Whenever you make changes to code in the `./src` directory, you'll see the logs indicating that the service has restart automatically.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the command below to deploy the component to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect deploy ./architect.yml -e example-environment
```
