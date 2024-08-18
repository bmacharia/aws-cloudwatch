output "table_arn_repositories" {
  value = aws_dynamodb_table.repositories.arn
}

output "table_name_repositories" {
  value = aws_dynamodb_table.repositories.name
}

output "table_arn_connections" {
  value = aws_dynamodb_table.connections.arn
}

output "table_name_connections" {
  value = aws_dynamodb_table.connections.name
}