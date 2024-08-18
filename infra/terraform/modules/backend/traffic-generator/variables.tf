variable "global_prefix" {

}

variable "environment" {

}

variable "nodejs_runtime" {

}

variable "lambda_layer_arn" {

}

variable "urls" {
  type = list(string)
}

variable "lambda_insights_layer_arn" {
  description = "Lambda Insights layer ARN"
}

variable "evidently_project_arn" {
  description = "Evidently project ARN"
}