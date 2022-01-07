data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_region" "current" {}

# The VPC in which the Postgres database and Kubernetes cluster will live
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 3.0.0"

  name = "${var.prefix}-vpc"
  cidr = "10.0.0.0/16"

  azs             = [data.aws_availability_zones.available.names[0], data.aws_availability_zones.available.names[1]]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  create_database_subnet_group = true
  database_subnets             = ["10.0.3.0/24", "10.0.4.0/24"]

  enable_dns_hostnames = true
}

# The Postgres database that stores react-app data
module "postgres_db" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "~> 5.2.0"

  name           = "${var.prefix}-postgres"
  engine         = "aurora-postgresql"
  engine_version = "11.9"
  instance_type  = "db.t3.medium"

  vpc_id  = module.vpc.vpc_id
  subnets = module.vpc.database_subnets

  replica_count           = 1
  allowed_security_groups = [module.eks.worker_security_group_id]
  allowed_cidr_blocks     = module.vpc.database_subnets_cidr_blocks

  username               = var.postgres_user
  create_random_password = false
  password               = var.postgres_password
  database_name          = var.postgres_database
  port                   = var.postgres_port

  skip_final_snapshot = true
}

data "aws_eks_cluster" "cluster" {
  name = module.eks.cluster_id
}

data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_id
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority.0.data)
  token                  = data.aws_eks_cluster_auth.cluster.token
  load_config_file       = false
}

# The Kubernetes cluster which the react app is deployed to
module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "17.24.0"
  cluster_name    = "${var.prefix}-cluster"
  cluster_version = "1.19"
  subnets         = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  worker_groups = [
    {
      instance_type = "t2.medium"
      asg_max_size  = 2
    }
  ]

  workers_group_defaults = {
    root_volume_type = "gp2"
  }
}
