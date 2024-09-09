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

variable "basic_auth_enabled" {
  description = "Should the frontend by protected via Basic Auth?"
  type        = bool
}

variable "basic_auth_username" {
  description = "Username for basic authentication (if enabled)"
  type        = string
  default     = "cw-pro"
}

variable "basic_auth_password" {
  description = "Password for basic authentication (if enabled)"
  type        = string
  default     = "Password1!"
}
