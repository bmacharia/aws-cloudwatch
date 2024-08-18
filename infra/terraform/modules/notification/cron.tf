resource "aws_cloudwatch_event_rule" "notification-cron" {
  name                = "${var.global_prefix}-${var.environment}-notifications-cron"
  description         = "Notification cron job"
  schedule_expression = "rate(6 hours)"
}

resource "aws_cloudwatch_event_target" "notification-cron-target" {
  rule      = aws_cloudwatch_event_rule.notification-cron.name
  target_id = "step-function-target"
  arn       = aws_sfn_state_machine.stepfunction.arn
  role_arn  = aws_iam_role.notification-role.arn
}
