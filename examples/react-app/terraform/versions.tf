terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.71.0"
    }
    kubernetes = {
      version = "~> 2.7.1"
    }
  }

  backend "s3" { }
}
