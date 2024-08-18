data "local_file" "archive" {
  filename = "${local.root}/backend/dist/notification-cron.zip"
}



resource "aws_lambda_function" "notification_lambda" {
  function_name    = "${var.global_prefix}-${var.environment}-notification-cron"
  role             = aws_iam_role.lambda-role.arn
  memory_size      = 200
  timeout          = 15
  handler          = "out/notification-cron.handler"
  runtime          = var.nodejs_runtime
  filename         = data.local_file.archive.filename
  source_code_hash = data.local_file.archive.content_base64sha256
  layers           = [var.lambda_layer_arn, var.lambda_insights_layer_arn]
  architectures    = ["arm64"]

  tracing_config {
    mode = "Active"
  }

}


resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.notification_lambda.function_name}"
  retention_in_days = 14
}
