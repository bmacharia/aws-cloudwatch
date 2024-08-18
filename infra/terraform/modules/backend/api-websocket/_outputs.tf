output "apigw_url" {
  value = aws_apigatewayv2_stage.stage.invoke_url
}

output "apigw_stage_arn" {
  value = aws_apigatewayv2_stage.stage.arn
}

output "websocket_api_connection_management_arn" {
  value = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${aws_apigatewayv2_api.websocket_api.id}/${aws_apigatewayv2_stage.stage.id}/POST/@connections"
}
