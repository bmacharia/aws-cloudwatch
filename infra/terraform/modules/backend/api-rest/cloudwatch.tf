resource "aws_cloudwatch_log_group" "access_logs" {
  name              = "/aws/apigateway/${aws_api_gateway_rest_api.rest_api.id}/access_logs"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "execution_logs" {
  name              = "API-Gateway-Execution-Logs_${aws_api_gateway_rest_api.rest_api.id}/prod"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.main.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_data_protection_policy" "example" {
  log_group_name = aws_cloudwatch_log_group.lambda.name

  policy_document = jsonencode({
    Name    = "Example"
    Version = "2021-06-01"

    Statement = [
      {
        Sid            = "Audit"
        DataIdentifier = ["arn:aws:dataprotection::aws:data-identifier/IpAddress"]
        Operation = {
          Audit = {
            FindingsDestination = {}
          }
        }
      },
      {
        Sid            = "Redact"
        DataIdentifier = ["arn:aws:dataprotection::aws:data-identifier/IpAddress"]
        Operation = {
          Deidentify = {
            MaskConfig = {}
          }
        }
      }
    ]
  })
}

resource "aws_cloudwatch_log_metric_filter" "info_logs_filter" {
  name           = "InfoLevelLogs"
  pattern        = "{ $.logLevel = \"INFO\" }"
  log_group_name = aws_cloudwatch_log_group.lambda.name

  metric_transformation {
    name      = "InfoLogsCount"
    namespace = "awsfundamentals/repotracker"
    value     = "1"
    unit      = "Count"

    dimensions = {
      ByFunctionName = "$.lambdaFunction.name"
    }
  }
}