variable "global_prefix" {

}

variable "environment" {

}

variable "frontend_url" {

}

variable "backend_url" {

}

variable "alarms_sns_topic_arn" {

}

# CRON that defines how often the canary should run.
# Also see https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html
# run every 8 hours, but only on weekdays
variable "cron" {
  description = "CRON that defines how often the canary should run. Also see the AWS documentation for scheduled events."
  default     = "0 0/8 ? * MON-FRI *"
}

variable "enabled_canaries" {
  type    = list(string)
  default = []
}

variable "rum_monitor_name" {
  description = "Name of the RUM monitor which is necessary to link the canary to the RUM monitor."
}

variable "global_suffix" {
  
}