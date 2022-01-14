data "aws_availability_zones" "available" {
  state = "available"
}

# The VPC in which the Postgres database and Kubernetes cluster will live
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 3.11.0"

  name = "${var.prefix}-vpc"
  cidr = "10.0.0.0/16"

  azs             = [data.aws_availability_zones.available.names[0], data.aws_availability_zones.available.names[1], data.aws_availability_zones.available.names[2]]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  create_database_subnet_group = true
  database_subnets             = ["10.0.3.0/24", "10.0.4.0/24", "10.0.5.0/24"]

  enable_dns_hostnames = true
}

# RDS cluster parameter group to instruct RDS to only use SSL connections
resource "aws_rds_cluster_parameter_group" "aurora_ssl" {
  name   = "${var.prefix}-postgres"
  family = "aurora-postgresql11"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "immediate"
  }
}

# The Postgres database that stores react-app data
module "postgres_db" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "~> 6.1.3"

  name           = "${var.prefix}-aurora"
  engine         = "aurora-postgresql"
  engine_version = "11.9"

  vpc_id  = module.vpc.vpc_id
  subnets = module.vpc.database_subnets

  instance_class = "db.t3.large"
  instances = {
    main   = {}
    reader = {}
  }

  autoscaling_enabled      = true
  autoscaling_min_capacity = 2
  autoscaling_max_capacity = 5

  allowed_security_groups = [module.eks.node_security_group_id]
  allowed_cidr_blocks     = module.vpc.database_subnets_cidr_blocks

  storage_encrypted = true

  master_username        = var.postgres_user
  create_random_password = false
  master_password        = var.postgres_password
  database_name          = var.postgres_database
  port                   = 5432

  skip_final_snapshot                 = false
  enabled_cloudwatch_logs_exports     = ["postgresql"]
  db_cluster_parameter_group_name     = aws_rds_cluster_parameter_group.aurora_ssl.name
  deletion_protection                 = true
  iam_database_authentication_enabled = true
  monitoring_interval                 = 60
  copy_tags_to_snapshot               = true
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
}

# The Kubernetes cluster which the react app is deployed to
module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "18.0.4"
  cluster_name    = "${var.prefix}-cluster"
  cluster_version = "1.21"
  subnet_ids      = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  eks_managed_node_group_defaults = {
    instance_types = ["t3a.medium"]
  }

  eks_managed_node_groups = {
    main = {
      min_size     = 3
      max_size     = 10
      desired_size = 3

      security_group_rules = {
        allOutbound = { # outbound communication from nodes including to DB
          type             = "egress"
          from_port        = 0
          to_port          = 0
          protocol         = "-1"
          cidr_blocks      = ["0.0.0.0/0"]
          ipv6_cidr_blocks = ["::/0"]
        }

        VPCInbound = { # communication between cluster nodes
          type             = "ingress"
          from_port        = 0
          to_port          = 0
          protocol         = "-1"
          cidr_blocks      = module.vpc.private_subnets_cidr_blocks
        }
      }
    }
  }
}
