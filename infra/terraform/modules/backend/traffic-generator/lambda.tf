data "local_file" "archive" {
  filename = "${local.root}/backend/dist/traffic-generator.zip"
}

resource "aws_lambda_function" "main" {
  function_name    = "${var.global_prefix}-${var.environment}-traffic-gen"
  role             = aws_iam_role.main.arn
  memory_size      = 1024
  timeout          = 15
  handler          = "out/traffic-generator.handler"
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
      MAX_CONCURRENCY                              = 1
      MAX_WAIT_SECONDS                             = 20
      URLS                                         = join(",", var.urls)
      EVIDENTLY_PROJECT_ARN                        = var.evidently_project_arn
    }
  }
}
