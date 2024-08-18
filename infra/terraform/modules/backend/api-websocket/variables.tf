variable "global_prefix" {
  description = "value of global_prefix"
}

variable "environment" {
  description = "value of environment"
}

variable "nodejs_runtime" {
  description = "NodeJS runtime version"
}

variable "table_arn_repositories" {
  description = "DynamoDB table ARN"
}

variable "table_name_repositories" {
  description = "DynamoDB table name"
}

variable "table_arn_connections" {
  description = "DynamoDB table ARN"
}

variable "table_name_connections" {
  description = "DynamoDB table name"
}

variable "lambda_layer_arn" {
  description = "Lambda layer ARN"
}

variable "lambda_insights_layer_arn" {
  description = "Lambda Insights layer ARN"
}

variable "evidently_project_arn" {
  description = "Evidently project ARN"
}
