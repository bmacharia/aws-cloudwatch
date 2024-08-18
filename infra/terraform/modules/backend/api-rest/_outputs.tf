output "apigw_url" {
  value = aws_api_gateway_stage.stage.invoke_url
}

output "lambda_function_name" {
  value = aws_lambda_function.main.function_name
}

output "lambda_log_group_name" {
  value = aws_cloudwatch_log_group.lambda.name
}

output "rest_api_name" {
  value = aws_api_gateway_rest_api.rest_api.name
}