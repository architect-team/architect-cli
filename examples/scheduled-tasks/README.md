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

# Task scheduling / cron jobs

In addition to provisioning and updating persistent services, [Architect Components](//docs.architect.io/configuration) can also describe and create tasks that will run on a specified schedule (aka cron jobs).

Just like `services`, `tasks` can take advantage of Architect's embedded service discovery and network security features to automatically connect to peer services without additional configuration. This means that no additional configuration is needed when deploying the component to ensure it can perform its duties.

In this example component (described by the `architect.yml` file in this repo), we've registered a simple hello-world service and a `curler` task that will routinely make a call to the hello-world service. This task runs on a schedule indicated by the `schedule` field.

### Testing the component

When you run the component locally the task will be configured but won't run on its schedule. This is because the environment is short-lived by nature rendering schedules of little use. Instead, testing tasks can be done manually to ensure that they work correctly. Just run the component and then you'll be able to manually execute the task:

```sh
# Deploy the component locally
$ architect dev architect.yml

# In another terminal session, execute the task
$ architect task:exec --local scheduled-tasks curler
```
