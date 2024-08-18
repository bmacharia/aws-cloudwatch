variable "global_prefix" {
  description = "value of global_prefix"
}

variable "environment" {
  description = "value of environment"
}

variable "rest_lambda_function_name" {
  description = "value of rest_lambda_function_name"
}

variable "rest_api_name" {
  description = "value of rest_api_name"
}

variable "table_name_repositories" {
  description = "value of table_name_repositories"
}

variable "nodejs_runtime" {
  description = "NodeJS runtime version"
}

variable "lambda_layer_arn" {
  description = "Lambda layer ARN"
}

variable "discord_webhook_url" {
  description = "Discord webhook URL"
}

variable "lambda_insights_layer_arn" {
  description = "Lambda Insights layer ARN"
}

variable "email_addresses" {
  description = "Email addresses to receive alerts"
}

variable "evidently_project_arn" {
  description = "ARN of evidently project"
}