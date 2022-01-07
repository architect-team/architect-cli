terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.71.0"
    }
    kubernetes = {
      version = "~> 1.9"
    }
  }

  backend "s3" { }
}
