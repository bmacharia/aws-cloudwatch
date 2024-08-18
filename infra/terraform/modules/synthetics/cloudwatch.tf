# -------------------------------------------------
# SYNTHETICS --------------------------------------

# a heartbeat canary that checks that the backend is up and running
resource "aws_synthetics_canary" "canary" {
  for_each                 = { for idx, val in local.canaries : idx => val }
  name                     = "${var.global_prefix}-${var.environment}-${replace(each.value, "canary_", "")}"
  artifact_s3_location     = "s3://${aws_s3_bucket.main.id}"
  execution_role_arn       = aws_iam_role.synthetics_canary_role.arn
  start_canary             = true
  success_retention_period = 14
  failure_retention_period = 14

  handler         = "${each.value}.handler"
  s3_bucket       = aws_s3_bucket.main.id
  s3_key          = aws_s3_object.canary[each.key].key
  s3_version      = aws_s3_object.canary[each.key].version_id
  runtime_version = local.synthetics_runtime

  run_config {
    environment_variables = {
      FRONTEND_URL = "https://${var.frontend_url}"
      BACKEND_URL  = var.backend_url
    }
    timeout_in_seconds = 60
  }

  schedule {
    # let's do not run the canaries at the same time
    # but with an offset to avoid race conditions
    # as the canaries are running in the same environment
    # e.g. we're replacing 0 6 ? * MON-FRI * with
    # 0 6 ? * MON-FRI * for the first canary (starts at minute 1) and
    # 1 6 ? * MON-FRI * for the second canary (starts at minute 2) and
    # so on
    expression = "cron(${replace(var.cron, "0", each.key)})"
  }

  tags = {
    # if the canary is tagged with the RUM monitor name
    # it will be linked to the RUM monitor and appear
    # in the dashboard of RUM
    "${var.rum_monitor_name}" = ""
  }
}

# Grouping our canaries so they don't mix if we have different environments
# on the same AWS account
resource "aws_synthetics_group" "main" {
  name     = "${var.global_prefix}-${var.environment}"
}

resource "aws_synthetics_group_association" "main" {
  for_each   = { for idx, val in local.canaries : idx => val }
  group_name = aws_synthetics_group.main.name
  canary_arn = aws_synthetics_canary.canary[each.key].arn
}


# -------------------------------------------------
# ALARMS ------------------------------------------

resource "aws_cloudwatch_metric_alarm" "failure_alarm" {
  for_each = { for idx, val in local.canaries : idx => val }
  # the prefix is needed, else the alarm won't be shown in the canary's alarms tab
  alarm_name          = "Synthetics-Alarm-${aws_synthetics_canary.canary[each.key].name}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "Failed"
  namespace           = "CloudWatchSynthetics"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "The '${aws_synthetics_canary.canary[each.key].name}' canary has failed."

  dimensions = {
    CanaryName = aws_synthetics_canary.canary[each.key].name
  }

  alarm_actions = [var.alarms_sns_topic_arn]

  treat_missing_data = "notBreaching"

  tags = {
    # https://repost.aws/en/questions/QUkuccNLHoS8K-1f-QSLjSRg/linking-cloudwatch-rum-app-to-cloudwatch-canary
    "${var.rum_monitor_name}" = ""
  }
}
