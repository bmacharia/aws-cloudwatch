locals {
  global_prefix = "cw-ho-tf"
  region        = "us-east-1"
  environment   = "dev"
  root          = "../../../.."

  nodejs_runtime = "nodejs18.x"
  env_contents   = fileexists("${path.module}/${local.root}/.env.${local.environment}") ? split("\n", trimspace(file("${path.module}/${local.root}/.env.${local.environment}"))) : []
  env_map        = length(local.env_contents) > 0 ? { for line in local.env_contents : split("=", line)[0] => split("=", line)[1] if length(split("=", line)) == 2 } : {}

  enable_anomaly_detection = false

  lambda_insights_layer_arn = "arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension-Arm64:11"

  default_tags = {
    App         = local.global_prefix
    Environment = local.environment
  }
}
