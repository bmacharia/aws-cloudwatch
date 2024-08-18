output "alarms_sns_topic_arn" {
  value = aws_sns_topic.main.arn
  description = "The ARN of the SNS topic to which alarms are sent"
}