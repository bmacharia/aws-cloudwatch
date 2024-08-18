
// Role & Policies for the Lambda Function within the Step Function
resource "aws_iam_role" "lambda-role" {
  name = "${var.global_prefix}-${var.environment}-notifications-cron-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}


resource "aws_iam_policy" "policy-add-logs" {
  name = "${var.global_prefix}-${var.environment}-notifications-cron-lambda"
  path = "/"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda-logs-policy-attachment" {
  role       = aws_iam_role.lambda-role.name
  policy_arn = aws_iam_policy.policy-add-logs.arn
}

resource "aws_iam_role_policy_attachment" "cloudwatch_lambda_insights" {
  role       = aws_iam_role.lambda-role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy"
}


resource "aws_iam_role_policy_attachment" "policy-attachment-xray" {
  role       = aws_iam_role.lambda-role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

// Role & Policies for the Step Function to assume

resource "aws_iam_role" "step-function-role" {
  name = "${var.global_prefix}-${var.environment}-notif-step-function-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "states.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}


resource "aws_iam_policy" "step-function-policy" {
  name        = "${var.global_prefix}-${var.environment}-notif-step-function-policy"
  description = "Combined policy for the notification Step Function and additional permissions"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:Scan",
          "dynamodb:PutItem"
        ],
        Resource = ["${var.repository_table_arn}", "${var.connection_table_arn}"]
      },
      {
        Effect = "Allow",
        Action = [
          "states:StartExecution",
          "states:DescribeExecution",
          "states:InvokeHTTPEndpoint"
        ],
        Resource = "*"
      },
      {
        Effect   = "Allow",
        Action   = "events:RetrieveConnectionCredentials",
        Resource = aws_cloudwatch_event_connection.mock_connection.arn
      },
      {
        Effect = "Allow",
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue"
        ],
        Resource = aws_cloudwatch_event_connection.mock_connection.secret_arn
      },
      {
        Effect = "Allow",
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "execute-api:Invoke",
        ],
        Resource = "${var.api_gateway_websocket_arn}/*"
      },
      {
        Effect = "Allow",
        Action = [
          "lambda:InvokeFunction"
        ],
        Resource = aws_lambda_function.notification_lambda.arn
      },
      {
        Effect   = "Allow"
        Action   = "execute-api:ManageConnections"
        Resource = "${var.websocket_api_connection_management_arn}/{connectionId}"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "sfn-policy-attachment-xray" {
  role       = aws_iam_role.step-function-role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}


resource "aws_iam_role_policy_attachment" "step-function-policy-attachment" {
  role       = aws_iam_role.step-function-role.name
  policy_arn = aws_iam_policy.step-function-policy.arn
}



resource "aws_iam_role" "notification-role" {
  name = "${var.global_prefix}-${var.environment}-notifications-cron-eventbridge"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "eventbridge_policy" {
  name        = "${var.global_prefix}-${var.environment}-eventbridge-stepfunction-execution-policy"
  description = "Policy to allow EventBridge to invoke Step Function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = "states:StartExecution"
        Effect   = "Allow"
        Resource = aws_sfn_state_machine.stepfunction.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eventbridge_policy_attachment" {
  role       = aws_iam_role.notification-role.name
  policy_arn = aws_iam_policy.eventbridge_policy.arn
}

