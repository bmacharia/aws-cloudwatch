resource "aws_cloudfront_function" "basic_auth" {
  name    = "${var.global_prefix}-${var.environment}-edge"
  runtime = "cloudfront-js-1.0"
  comment = "Basic Auth protection function"

  code = templatefile("${path.module}/viewer-request.js", {
    basic_auth_username = var.basic_auth_username
    basic_auth_password = var.basic_auth_password
  })
}
