<p align="center">
  <a href="//architect.io" target="blank"><img src="https://www.architect.io/img/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# React JS example

An extremely common, modern application stack includes three services: a frontend webapp, a server-side API, and a database. In this example, you'll learn how that stack can be captured in an Architect component to enable automated deployments, networking, and network security for your application wherever it gets deployed to.

In the `architect.yml` file for this project, we describe all three of these services as deployable runtimes. However, we also leverage Architect's [service discovery](https://www.architect.io/docs/configuration/service-discovery) features to populate environment parameters by reference. This not only allows us to automatically connect the services to each other, but it also allows Architect to build strict network policies to whitelist the traffic between these services. Now we won't have any work ahead of us to promote this stack from local dev all the way through to production readiness!

[Learn more about the architect.yml file](//docs.architect.io/configuration/architect-yml)

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/react-app-rds

# Register the component to the local registry
$ architect link .

# Deploy using the --local flag
$ architect deploy --local examples/react-app:latest -i app:app
```

Once the deploy has completed, you can reach your new service by going to http://app.arc.localhost/.

## Creating remote infrastructure

Terraform templates for running the component in a remote environment can be found in the `terraform` directory. Ensure that [`terraform`](https://learn.hashicorp.com/tutorials/terraform/install-cli) is installed and that you have an AWS account, then follow the next steps.

First, navigate to the `terraform` folder in your terminal, then set the environment variables for your AWS credentials like so:

```sh
export AWS_ACCESS_KEY_ID=<aws_access_key>
export AWS_SECRET_ACCESS_KEY=<aws_secret_access_key>
export AWS_DEFAULT_REGION=<aws_region>
```

Next, create an AWS S3 bucket where the terraform remote state should be stored. Use it in the following command to initialize terraform:

```sh
terraform init -backend-config="bucket=<s3_bucket_name>" -backend-config="region=<aws_region>" -backend-config="key=<aws_access_key>"
```

Once terraform is initialized, some values will need to be set for the future infrastructure. Still in the `terraform` folder, create a file called `values.tfvars` and add the following contents:

```
prefix = "react-app-rds"
postgres_user = "architect"
postgres_password = "architect"
postgres_database = "architect"
postgres_port = "5432"
```

These values can be changed but reasonable defaults have been provided. Next, plan the infrastructure by running the following in your terminal:

```sh
terraform plan -out tfplan -var-file values.tfvars
```

A list of resources to create will be displayed. Create the infrastructure by running the following:

```sh
terraform apply tfplan
```

This will take several minutes and once it's done, the message `Apply complete!` will be printed. Move on to the next section to learn how to run the Architect component on your new infrastructure.

## Deploying to the cloud

TODO

