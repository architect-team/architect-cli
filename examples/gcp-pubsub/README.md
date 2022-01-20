<p align="center">
  <a href="//architect.io" target="blank"><img src="https://www.architect.io/img/logo.svg" width="480" alt="Architect Logo" /></a>
</p>

<p align="center">
  Example project using Architect to broker connectivity to GCPs Pub/Sub service
</p>

## Getting started

With event-driven architectures, applications are dependent on both the component publishing a topic they need to consume as well as the broker facilitating the request. The subscriber component has a dependency on the GCP pub/sub component as well as the publisher component, so that means we can simply deploy the subscriber to see the whole stack materialize:

```sh
$ architect dev ./subscriber --values values.yml
```
