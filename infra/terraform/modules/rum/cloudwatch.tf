resource "aws_rum_app_monitor" "main" {
  name   = "${var.global_prefix}-${var.environment}"
  domain = var.frontend_domain
  app_monitor_configuration {
    allow_cookies       = true
    enable_xray         = true
    excluded_pages      = []
    favorite_pages      = []
    included_pages      = []
    session_sample_rate = 1
    guest_role_arn      = aws_iam_role.rum_guest_role.arn
    telemetries         = ["errors", "performance", "http"]
  }
  custom_events {
    status = "ENABLED"
  }
  cw_log_enabled = true
}

resource "aws_rum_metrics_destination" "main" {
  app_monitor_name = aws_rum_app_monitor.main.name
  destination      = "CloudWatch"
}

resource "aws_cloudwatch_log_metric_filter" "use_searchbar" {
  name           = "${var.global_prefix}-${var.environment}-use-searchbar"
  pattern        = "{ $.event_type = \"UseSearchBar\" }"
  log_group_name = aws_rum_app_monitor.main.cw_log_group

  metric_transformation {
    name          = "UseSearchBar"
    namespace     = "RumMetrics"
    value         = 1
    default_value = 0
    unit          = "Count"
  }
}
