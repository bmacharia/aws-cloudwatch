terraform {
  required_version = "=1.6.6"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.31.0"
      configuration_aliases = [aws.us-east-1]
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 3.21.0"
    }
  }
}
