---
title: Working With Tasks
---

# Working With Tasks

Sometimes you want to execute some command on a recurring basis, or as a one-off operation. Architect components have the concept of a Task,
similar to a cron job. Since Tasks are defined in a component in the similar way to Services, you can configure your tasks with dependencies on
other components, take parameters, or call a service defined in the same component.

In this guide, we will walk through the process of creating a new Component with a Task that exercises most of the features available to Tasks.
1. Create an example container and script to run as a Task
2. Defining a minimal Component with a Task, and execute it locally
3. Updating the Component to improve local development experience
4. Tasks with Parameters
5. Tasks with Dependencies

## Create a Script and Dockerfile for our Task

Before we get started with the components, let's create a script for our task, and a dockerfile so we can bake the script into an image.

```shell
% mkdir ./my-task
% cd ./my-task
% touch Dockerfile my-task.sh
```

The `Dockerfile`:

```dockerfile
FROM alpine:3.14
COPY my-task.sh /my-task.sh
CMD ["sh", "-c", "/my-task.sh"]
```

The `my-task.sh`:

```sh
#!/usr/bin/env sh
echo "${GREETING:-Hello}, world!"
```

With those created, let's build the docker image and execute it, just to verify it's working as expected.

```shell
% docker build . -t my-task:latest -q
sha256:d7116f02d2220db058c3df25417894fae557ae55875c9abb5f14946aa6c9b8ee

% docker run my-task:latest
Hello, world!

% docker run -e GREETING=Hola my-task:latest
Hola, world!
```

We can see that when the task runs without the `GREETING` environment variable, it displayed the typical "Hello, world!",
but will provide a more customized message when the `GREETING` variable is provided. With our docker image working, let
proceed with creating the Architect Component and Task.

## Define a Minimal Component Task

In our `my-task` directory, let's create an architect file to define our component:

```shell
touch architect.yml
```

Now we can create a Task in the component file just as we would a Service. In this case we'll give the component a brief description, a blank schedule so it runs only when manually executed, and finally we provide the build context as the local directly. We won't cover all the nuance in the task definition here, but the [Component Task docs](docs/1-components/5-tasks.md) go into more depth, as do the [Task Reference docs](docs/5-reference/2-architect.yml).

The `architect.yml`:

```yaml
name: brahm-testing/my-task
description: A hello world task! 👋

tasks:
  hello-world:
    schedule: ""
    build:
      context: ./
```

We can validate the component to verify we haven't made any mistakes:

```shell
% architect validate ./architect.yml
✅ brahm-testing/my-task: /Users/brahmlower/development/my-task/architect.yml
```

To run this locally, we'll need to link the component by running:

```shell
% architect link ./architect.yml
Successfully linked brahm-testing/my-task to local system at /Users/brahmlower/development/my-task/architect.yml.
```

Now that the component is linked, we can deploy it locally using the `architect dev`
command. Under the hood, this creates a docker-compose file which will be used
as we execute the task.

```shell
% architect dev brahm-testing/my-task
...
```

And now we can execute the task locally:

```shell
% architect task:exec --local brahm-testing/my-task hello-world
Running task brahm-testing/my-task/hello-world:latest in the local architect environment...

Creating architect-task-hello-world-xhkltnus_run ...
Creating architect-task-hello-world-xhkltnus_run ... done
Hello, world!


Successfully ran task.
```

And there you have it; we've executed our task locally! But let's improve the component definition to reduce
friction during development.

## Local Task Development

Development generally requires rapid iteration, and needing to run `dev` and `task:exec` each time you
want to test can be a tedious experience. To alleviate this, we can make use of the `debug` feature to mount
our source code when we run the task without having to re-deploy. This can be achieved by updating the
component with a debug block, re-deploying (just the once) to update the component configuration. We will
only use a few of the available local development features, but more info can be found in the
[Local Configuration docs](docs/1-components/7-local-configuration.md).

Let's update the architect file with the debug block containing a volume mount that overrides the script in
the container with the script from the local filesystem:

```diff
 tasks:
   hello-world:
     schedule: ""
     build:
       context: ./
+    ${{ if architect.environment == 'local' }}:
+      volumes:
+        src:
+          mount_path: /my-task.sh
+          host_path: ./my-task.sh
```

We will have to redeploy the component because we change its definition, so lets redeploy and then execute it
again to make sure everything is still working as expected.

```shell
% architect dev brahm-testing/my-task
...
% architect task:exec --local brahm-testing/my-task hello-world
...
Hello, world!
```

Excellent! With this version of our component, the `my-task.sh` script is being mounted into the container
and used when the task is executed. We should make a change to the script and re-execute the task to verify this:

Change the `my-task.sh` file to include a waving emoji in the output:

```diff
 #!/usr/bin/env sh
-echo "${GREETING:-Hello}, world!"
+echo "${GREETING:-Hello}, world! 👋"
```

Now we'll see the emoji in the output when we execute the task again without re-registering or re-deploying the component:

```shell
% architect task:exec --local brahm-testing/my-task hello-world
...
Hello, world! 👋
```

## Tasks with Parameters

The task we create supports a `GREETING` environment variable, so let's make use of that as we deploy the component by
setting a value as a parameter. In addition to adding the `parameters` section to the component, we'll also declare the `GREETING` environment variable on the task, and assign it to the value given by the parameter. More information about parameters can be found in the [Components Parameters docs](docs/1-components/6-parameters.md) and the
[Parameters Reference docs](docs/5-reference/2-architect.yml).

The `architect.yml` file:

```diff
 name: brahm-testing/my-task
 description: A hello world task! 👋

+parameters:
+  greeting:
+    required: false
+    description: The greeting to use
+
 tasks:
   hello-world:
     schedule: ""
     build:
       context: ./
+    environment:
+      GREETING: ${{ parameters.greeting }}
     ${{ if architect.environment == 'local' }}:
       volumes:
         src:
```

Now we can redeploy the component with a parameter value, whose value will be used when the task is executed. It's
important to understand that these parameters are set at deploy time, so we cannot re-declare the `GREETING` value later
when we execute the task.


```shell
% architect dev brahm-testing/my-task -p greeting=Hola
...
% architect task:exec --local brahm-testing/my-task hello-world
Hola, world! 👋
...
```

## Tasks with Dependencies

As we mentioned earlier, tasks can use the same facilities as services which also means a Task can depend on a Service,
just as Services can depend on other Services. Let's expand the component to include a service for generating names to
use in our tasks greeting.

To start, let's add a really simple node server in a file called `server.js`, and make a dedicated docker image.

```shell
% mkdir ./server
% touch ./server/server.js
% touch ./server/Dockerfile
```

The `server/server.js`:
```js
const http = require('http');

const names = ['April', 'Katie', 'Marlon', 'Darnell', 'Simon', 'Lena', 'Noah'];

const requestListener = function (req, res) {
  const name = names[names.length * Math.random() | 0];
  res.writeHead(200);
  res.end(name);
}

const server = http.createServer(requestListener);
server.listen(9000);
```

The `server/Dockerfile`:
```dockerfile
FROM node:16-alpine3.11
COPY server.js /server.js
CMD ["node", "/server.js"]
```

The server will respond with just the name in the body, so we can update the script to simply curl the
server address provided by the API_URL variable.

```diff
 #!/usr/bin/env sh
-echo "${GREETING:-Hello}, world! 👋"
+echo "${GREETING:-Hello}, $(curl -s $API_URL)! 👋"
```

Now let's add the service to the architect file, and then pass the URL for the service into the task using
the environment variable we reference in the script:

```diff
     required: false
     description: The greeting to use

+services:
+  name-generator:
+    build:
+      context: ./server
+    interfaces:
+      main:
+        port: 9000
+
 tasks:
   hello-world:
     schedule: ""
@@ -13,6 +24,7 @@ tasks:
       context: ./
     environment:
       GREETING: ${{ parameters.greeting }}
+      API_URL: ${{ services.name-generator.interfaces.main.url }}
     ${{ if architect.environment == 'local' }}:
       volumes:
         src:
```

Great! Now lets deploy our changes.

```shell
% architect dev --detached brahm-testing/my-task -p greeting=Hola
Building containers... done

Once the containers are running they will be accessible via the following urls:
http://localhost:50006/ => my-task-name-generator-0s8tot3o:9000

Starting containers...
```

And now when we execute the task again, we'll see a greeting for a random name provided by the dependent service:

```
% architect task:exec --local brahm-testing/my-task hello-world
...
Hola, Katie! 👋
```
