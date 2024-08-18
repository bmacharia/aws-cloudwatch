variable "project_suffix" {
  description = "Custom suffix that we apply to resources that need unique global namings like S3 buckets"
  type        = string
}

variable "alerting_emails" {
  description = "Email addresses that should receive alerts (comma separated)"
  type        = string
}

variable "discord_webhook_url" {
  description = "Discord Webhook URL to receive Lambda alerts"
  type        = string
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
}