resource "aws_cloudwatch_log_group" "websocket_access_logs" {
  name              = "/aws/apigateway/${aws_apigatewayv2_api.websocket_api.id}/access_logs"
  retention_in_days = 7
}