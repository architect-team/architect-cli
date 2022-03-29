---
title: Observability
---
# Observability
Up until now, you have used Architect to develop and deploy your application. However, Architect's role in your development process does not end there. You still need to monitor the system and be able to dive in when a problem occurs. To help facilitate this, Architect provides some helpful commands that will allow you better insights into how your system is doing.

Whether it be a remote deployment using [`architect deploy`](/reference/cli/#architect-deploy-configs_or_components) or a local one using [`architect dev`](http://localhost:8000/reference/cli/#architect-dev-configs_or_components) these commands will give you a deeper insight into your product.

We will assume that you have deployed the example react app to a remote environment for the following examples.
```sh
$ architect register ./examples/react-app/
$ Architect deploy react-app
```

## Logging

As your application runs, it will generally print important information to stdout and stderr as it runs. The log command will allow you to stream those logs from a remote service to your console. For instance, let's say you wanted to see the latest logs for the API of the example react app. You would do the following.
```sh
$ architect logs -a my_account -e my_environment react-app.services.api
```
*If you are unsure what your account, environment, or service name are, you can leave them blank, and Architect will prompt you will a list of valid options.*
The output would be
```sh
Logs:
―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
api | {"message":"GET /names","level":"info","service":"backend"}
api | Executing (default): SELECT "id", "name", "createdAt", "updatedAt" FROM "names" AS "na
api | me" ORDER BY "name"."id" DESC;
```

To have a constant stream of logs, you can add the `--follow` flag to the command.
```sh
$ architect logs -a my_account -e my_environment react-app.services.api
```
For more options please take a look at our [Readme](/reference/cli/#architect-logs-resource).

## Remote Execution

Sometimes logs do not paint the complete picture of what is happening in production, or you may want to run some unique script on a remote deployment. Either way, Architect has you covered with our `exec` command. Using this command, we can run arbitrary commands on any remote service.
By providing the command with the name of a service, a container running that service is picked, and the container will execute your designated command. So, for instance, if you were running the react example app and wanted to know what the remote file structure looked like, you could run.
```sh
$ architect exec -a my_account -e my_environment react-app.services.api -- ls
```
Which would output
```sh
Dockerfile         node_modules       package.json
logs               package-lock.json  src
```
While this is great for quick one-off commands, sometimes a more interactive approach would be preferred. Instead, you can create an interactive session with the remote container using the `-ti` flags.
```sh
$ architect exec -ti -a my_account -e my_environment react-app.services.api -- sh
```
Which would provide us with an interactive terminal.
```sh
/usr/src/app #
```
NOTE: Depending on the base image your service is using, `sh` might not be a valid command. If not, the other most common terminal is `/bin/bash`.

For more options please take a look at our [Readme](/reference/cli/#architect-exec-resource-flags----command).
