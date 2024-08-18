data "local_file" "archive" {
  filename = "${local.root}/backend/dist/api-rest.zip"
}

resource "aws_lambda_function" "main" {
  function_name    = "${var.global_prefix}-${var.environment}-api-rest"
  role             = aws_iam_role.main.arn
  memory_size      = 1024
  timeout          = 15
  handler          = "out/api-rest.handler"
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
      TABLE_NAME_REPOSITORIES = var.table_name_repositories
      TABLE_NAME_CONNECTIONS  = var.table_name_connections
      EVIDENTLY_PROJECT_ARN   = var.evidently_project_arn
    }
  }
}
