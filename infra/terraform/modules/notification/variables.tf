variable "global_prefix" {
  description = "value of global_prefix"
}

variable "environment" {
  description = "value of environment"
}

variable "nodejs_runtime" {
  description = "NodeJS runtime version"
}

variable "connection_table_name" {
  description = "Name of the connection table"
}

variable "repository_table_name" {
  description = "Name of the repository table"
}

variable "repository_table_arn" {
  description = "ARN of the repository table"
}

variable "connection_table_arn" {
  description = "ARN of the connection table"
}

variable "api_gateway_websocket_arn" {
  description = "ARN of the API Gateway Websocket"
}

variable "websocket_api_connection_management_arn" {
  description = "ARN of the API Gateway Websocket connection management"
}

variable "lambda_layer_arn" {
  description = "Lambda layer ARN"
}

variable "api_gateway_websocket_url" {
  description = "URL of the API Gateway Websocket"
}

variable "lambda_insights_layer_arn" {
  description = "Lambda Insights layer ARN"
}
