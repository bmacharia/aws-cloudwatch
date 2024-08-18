resource "aws_cloudwatch_event_connection" "mock_connection" {
  name               = "${var.global_prefix}-${var.environment}-api-connection"
  description        = "A connection with a mock key since this is required."
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "key"
      value = "1234"
    }
  }
}


resource "aws_sfn_state_machine" "stepfunction" {
  name     = "${var.global_prefix}-${var.environment}-sfn-notification-cron"
  role_arn = aws_iam_role.step-function-role.arn
  tracing_configuration {
    enabled = true
  }
  definition = <<EOF
{
  "Comment": "A step function to get a diff of all repositories and send notifications",
  "StartAt": "Get All Repositories",
  "States": {
    "Get All Repositories": {
      "Type": "Task",
      "Parameters": {
        "TableName": "${var.repository_table_name}"
      },
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:scan",
      "Next": "Map over all repositories",
      "ResultSelector": {
        "Items.$": "$.Items[*]"
      }
    },
    "Map over all repositories": {
      "Type": "Map",
      "ItemProcessor": {
        "ProcessorConfig": {
          "Mode": "INLINE"
        },
        "StartAt": "Get Repo Data From GitHub API",
        "States": {
          "Get Repo Data From GitHub API": {
            "Type": "Task",
            "Resource": "arn:aws:states:::http:invoke",
            "Parameters": {
              "Method": "GET",
              "Authentication": {
                "ConnectionArn": "${aws_cloudwatch_event_connection.mock_connection.arn}"

              },
              "ApiEndpoint.$": "States.Format('https://api.github.com/repos/{}', $.originalRepo.full_name.S)"
            },
            "Retry": [
              {
                "ErrorEquals": [
                  "States.ALL"
                ],
                "BackoffRate": 2,
                "IntervalSeconds": 1,
                "MaxAttempts": 3,
                "JitterStrategy": "FULL"
              }
            ],
            "Next": "Diff",
            "ResultSelector": {
              "full_name.$": "$.ResponseBody.full_name",
              "description.$": "$.ResponseBody.description",
              "forks.$": "$.ResponseBody.forks",
              "language.$": "$.ResponseBody.language",
              "last_updated.$": "$.ResponseBody.updated_at",
              "stars.$": "$.ResponseBody.stargazers_count",
              "subscribers_count.$": "$.ResponseBody.subscribers_count",
              "created_at.$": "$.ResponseBody.created_at",
              "open_issues_count.$": "$.ResponseBody.open_issues_count",
              "avatar_url.$": "$.ResponseBody.owner.avatar_url"
            },
            "ResultPath": "$.currentRepo"
          },
          "Diff": {
            "Type": "Task",
            "Resource": "arn:aws:states:::lambda:invoke",
            "OutputPath": "$.Payload",
            "Parameters": {
              "Payload.$": "$",
              "FunctionName": "${aws_lambda_function.notification_lambda.function_name}"
            },
            "Retry": [
              {
                "ErrorEquals": [
                  "Lambda.ServiceException",
                  "Lambda.AWSLambdaException",
                  "Lambda.SdkClientException",
                  "Lambda.TooManyRequestsException"
                ],
                "IntervalSeconds": 1,
                "MaxAttempts": 3,
                "BackoffRate": 2
              }
            ],
            "Next": "Difference?"
          },
          "Difference?": {
            "Type": "Choice",
            "Choices": [
              {
                "Variable": "$.hasChanged",
                "BooleanEquals": true,
                "Next": "DynamoDB PutItem",
                "Comment": "Repo has Changed"
              },
              {
                "Variable": "$.hasChanged",
                "BooleanEquals": false,
                "Next": "Success"
              }
            ]
          },
          "DynamoDB PutItem": {
            "Type": "Task",
            "Resource": "arn:aws:states:::dynamodb:putItem",
            "Parameters": {
              "TableName": "${var.repository_table_name}",
              "Item.$": "$.repo"
            },
            "Next": "Get WebSocket Connections",
            "ResultPath": null
          },
          "Get WebSocket Connections": {
            "Type": "Task",
            "Parameters": {
                      "TableName": "${var.connection_table_name}"
            },
            "Resource": "arn:aws:states:::aws-sdk:dynamodb:scan",
            "Next": "Broadcast WebSocket",
            "ResultPath": "$.connections"
          },
          "Broadcast WebSocket": {
            "Type": "Map",
            "ItemProcessor": {
              "ProcessorConfig": {
                "Mode": "INLINE"
              },
              "StartAt": "Send WebSocket Message",
              "States": {
                "Send WebSocket Message": {
                  "Type": "Task",
                  "Resource": "arn:aws:states:::apigateway:invoke",
                  "Parameters": {
                    "ApiEndpoint": "${local.ws_api_url}",
                    "Method": "POST",
                    "Headers": {
                      "Content-Type": [
                        "application/json"
                      ]
                    },
                    "Stage": "prod",
                    "Path.$": "States.Format('/@connections/{}', $.connectionItem.connection_id.S)",
                    "RequestBody": {
                      "repoName.$": "$.repoName"
                    },
                    "AuthType": "IAM_ROLE"
                  },
                  "End": true
                }
              }
            },
            "ItemsPath": "$.connections.Items",
            "ItemSelector": {
              "connectionItem.$": "$$.Map.Item.Value",
              "repoName.$": "$.repo.full_name.S"
            },
            "End": true
          },
          "Success": {
            "Type": "Succeed"
          }
        }
      },
      "End": true,
      "ItemsPath": "$.Items",
      "ItemSelector": {
        "originalRepo.$": "$$.Map.Item.Value"
      }
    }
  }
}
EOF

}
