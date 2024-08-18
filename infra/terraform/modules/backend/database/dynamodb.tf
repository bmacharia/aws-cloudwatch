resource "aws_dynamodb_table" "repositories" {
  name     = "${var.global_prefix}-${var.environment}-repositories"
  hash_key = "full_name"

  attribute {
    name = "full_name"
    type = "S"
  }

  billing_mode = "PAY_PER_REQUEST"
}

resource "aws_dynamodb_table" "connections" {
  name     = "${var.global_prefix}-${var.environment}-connections"
  hash_key = "connection_id"
  
  attribute {
    name = "connection_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  billing_mode   = "PAY_PER_REQUEST"
}