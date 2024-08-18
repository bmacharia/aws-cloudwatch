data "local_file" "archive" {
  filename = "${local.root}/backend/dist/sns-alarm.zip"
}

resource "aws_lambda_function" "main" {
  function_name    = "${var.global_prefix}-${var.environment}-sns-alarm"
  role             = aws_iam_role.main.arn
  memory_size      = 1024
  timeout          = 15
  handler          = "out/sns-alarm.handler"
  runtime          = var.nodejs_runtime
  filename         = data.local_file.archive.filename
  source_code_hash = data.local_file.archive.content_base64sha256
  layers           = [var.lambda_layer_arn, var.lambda_insights_layer_arn]
  architectures    = ["arm64"]


  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DISCORD_WEBHOOK_URL   = var.discord_webhook_url
      EVIDENTLY_PROJECT_ARN = var.evidently_project_arn
    }
  }
}
