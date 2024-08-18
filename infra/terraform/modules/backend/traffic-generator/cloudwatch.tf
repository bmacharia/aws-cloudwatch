# CRON that regularly triggers the lambda function
# once every 60 seconds
resource "aws_cloudwatch_event_rule" "every_minute" {
  name                = "${var.global_prefix}-${var.environment}-regulary-invoke"
  description         = "Fires every 10 minutes"
  schedule_expression = "rate(10 minutes)"
}

resource "aws_cloudwatch_event_target" "invoke_lambda_every_minute" {
  rule      = aws_cloudwatch_event_rule.every_minute.name
  target_id = "invoke_lambda_function"
  arn       = aws_lambda_function.main.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_to_call_main" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_minute.arn
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.main.function_name}"
  retention_in_days = 14
}
