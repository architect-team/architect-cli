<p align="center">
  <a href="//architect.io" target="blank"><img src="https://www.architect.io/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# Live reloading code changes

Its extremely tedious to have to rebuilt container images every time code changes occur. This problem explodes exponentially when dealing with connected services and components with dependencies. That's why its important to configure your components with `debug` features (e.g. features that execute only when running locally) that allow your containers to update automatically whenever code changes are detected.

The component in this example project describes only a single service, `api`, that builds and deploys the source code located in this directory. Inside the `architect.yml` file, you'll see that this service has a `debug` block that specifies a different `command` to run, `npm run dev`, which uses [nodemon](https://nodemon.io/) to auto-detect code changes and dynamically restart our web server. Unfortunately, our code changes won't sync with the built container by default, but this can be solved easily by creating a volume that maps our host directory with the container operating system.

### Testing this component

```sh
# Register the component locally
$ architect link .

# Deploy the component
$ architect deploy --local examples/hot-reloading:latest -i api:http
```

Once the component is live, make some changes to src/index.js and watch as your logs show the changes taking effect
