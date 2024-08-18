// SNS ----------------------------------------------------------------------

resource "aws_sns_topic" "main" {
  name = "${var.global_prefix}-${var.environment}-alarms"
}

# create topic subscription to lambda
resource "aws_sns_topic_subscription" "main" {
  topic_arn = aws_sns_topic.main.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.main.arn
}

resource "aws_sns_topic_subscription" "email_subscription" {
  count     = length(local.email_list)
  topic_arn = aws_sns_topic.main.arn
  protocol  = "email"
  endpoint  = local.email_list[count.index]
}
