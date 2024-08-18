resource "aws_cloudwatch_log_metric_filter" "rate_limited" {
  name           = "GithubRateLimitedCount"
  pattern        = "{ $.message = \"Rate limited by Github\" }"
  log_group_name = var.rest_lambda_log_group_name

  metric_transformation {
    name      = "RateLimitedCount"
    namespace = "awsfundamentals/repotracker"
    value     = "1"
    unit      = "Count"

    dimensions = {}
  }
}

resource "awscc_cloudwatch_alarm" "github_ratelimited_alarm" {
  alarm_name          = "${var.global_prefix}-${var.environment}-github-ratelimited-anomaly"
  comparison_operator = "LessThanLowerOrGreaterThanUpperThreshold"
  evaluation_periods  = 1

  metrics = [{
    expression = "ANOMALY_DETECTION_BAND(m1, 10)"
    id         = "ad1"
    },
    {
      id = "m1"
      metric_stat = {
        metric = {
          metric_name = aws_cloudwatch_log_metric_filter.rate_limited.metric_transformation[0].name
          namespace   = aws_cloudwatch_log_metric_filter.rate_limited.metric_transformation[0].namespace
        }
        period = 86400
        stat   = "Sum"
      }
  }]

  alarm_description = "Unusual number of Github API rate limit breaches"
  alarm_actions     = [var.alarms_sns_topic_arn]

  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"
}


resource "awscc_cloudwatch_alarm" "lambda_invocations_alarm" {
  alarm_name          = "${var.global_prefix}-${var.environment}-invocations-anomaly"
  comparison_operator = "LessThanLowerOrGreaterThanUpperThreshold"
  evaluation_periods  = 1

  metrics = [{
    expression = "ANOMALY_DETECTION_BAND(m1, 10)"
    id         = "ad1"
    },
    {
      id = "m1"
      metric_stat = {
        metric = {
          metric_name = "Invocations"
          namespace   = "AWS/Lambda"
        }
        period = 86400
        stat   = "Sum"
      }
  }]

  alarm_description = "Lambda invocations are outside of the expected bounds"
  alarm_actions     = [var.alarms_sns_topic_arn]

  threshold_metric_id = "ad1"
  treat_missing_data  = "notBreaching"
}
