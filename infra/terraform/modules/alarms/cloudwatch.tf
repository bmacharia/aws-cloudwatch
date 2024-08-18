# Attach Lambda function to SNS topic
resource "aws_lambda_permission" "sns" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.main.arn
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.global_prefix}-${var.environment}-lambda-errors-rest-api"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors the number of errors that occur in the lambda function"
  dimensions = {
    // Import from lambda
    FunctionName = var.rest_lambda_function_name
  }
  alarm_actions = [aws_sns_topic.main.arn]
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx_errors" {
  alarm_name          = "${var.global_prefix}-${var.environment}-api-gateway-5xx-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors the number of 5xx errors that occur in the API Gateway"
  dimensions = {
    ApiName = var.rest_api_name
  }
  alarm_actions = [aws_sns_topic.main.arn]
}

// Alarm for DynamoDB throttles
resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  alarm_name          = "${var.global_prefix}-${var.environment}-dynamodb-throttles"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "ConsumedReadCapacityUnits"
  namespace           = "AWS/DynamoDB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors the number of throttles that occur in the DynamoDB table"
  dimensions = {
    TableName = var.table_name_repositories
  }
  alarm_actions = [aws_sns_topic.main.arn]
}