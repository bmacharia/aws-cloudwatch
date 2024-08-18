output "identity_pool_arn" {
  value = aws_cognito_identity_pool.rum_identity_pool.id
}

output "guest_role_arn" {
  value = aws_iam_role.rum_guest_role.arn
}

output "app_monitor_name" {
  value = aws_rum_app_monitor.main.name
}

output "app_monitor_id" {
  value = aws_rum_app_monitor.main.app_monitor_id
}