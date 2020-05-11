## Example Application: Database Seeding Through Parameter Configuration

This example shows how we may use a service parameter to configure different database startup strategies.

In a developer environment, it may be that we want to auto-run database migrations at application startup, while in production we may consider that to be dangerous. This is one of many examples of how an environment operator may wish to modify application behavior depending on the environment. Architect provides a straightforward approach to such configuration:

(1) The service developer declares a parameter in the `architect.yml` file:

```
name: examples/typeorm-demo
// ...
parameters:
  // ...
  AUTO_DDL:
    description: Options are 'none', 'migrate', and 'seed'; none- no ddl; migrate- runs unrun database migrations at application start; seed- runs unrun migrations and test data seeding script at application start
    default: none
// ...
```

(2) Under the hood, the developer can make use of the value of that parameter by grabbing it from its environment variable:
```
    const auto_ddl = process.env.AUTO_DDL;

    if (auto_ddl === 'migrate') {
      await this.runMigrations();
    } else if (auto_ddl === 'seed') {
      await this.runMigrations();
      await this.seeDatabase();
    } else if (auto_ddl === 'none') {
      // do nothing...
    } else {
    // ...
  }
```

(3) The environment operator then has the chance to set the parameter value in the `arc.env.yml` file.

At runtime, a developer might configure their local environment like this so migrations run at startup...
```
services:
  examples/typeorm-demo:latest:
    // ...
    parameters:
      AUTO_DDL: migrate
```

...whereas a production operator may prefer to configure the environment to run without any migrations...
```
services:
  examples/typeorm-demo:latest:
    // ...
    parameters:
      AUTO_DDL: none
```

And the quality assurance organization may prefer to start the application up with seed data...
```
services:
  examples/typeorm-demo:latest:
    // ...
    parameters:
      AUTO_DDL: seed
```


## Recap

Environment-specific database manipulation presents a common problem for developing applications in a truly portable way. Architect's parameter construct provides a clean channel to communicate this information between service developers and service operators.

Questions? Don't hesitate to reach out to the architect team!
