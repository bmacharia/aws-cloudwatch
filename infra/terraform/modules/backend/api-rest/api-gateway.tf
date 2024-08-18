resource "aws_api_gateway_rest_api" "rest_api" {
  name        = "${var.global_prefix}-${var.environment}-rest-api"
  description = "REST API"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "proxy_resource" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  parent_id   = aws_api_gateway_rest_api.rest_api.root_resource_id
  path_part   = "{proxy+}"
}

# ALL METHODS EXCEPT OPTIONS ---------------------------------------------------

resource "aws_api_gateway_method" "proxy_method" {
  for_each         = toset(["POST", "GET", "PATCH", "PUT", "DELETE"])
  api_key_required = false
  rest_api_id      = aws_api_gateway_rest_api.rest_api.id
  resource_id      = aws_api_gateway_resource.proxy_resource.id
  http_method      = each.value
  authorization    = "NONE"
}

resource "aws_api_gateway_method_settings" "settings" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  stage_name  = aws_api_gateway_stage.stage.stage_name
  method_path = "*/*"
  settings {
    logging_level      = "INFO"
    data_trace_enabled = true
    metrics_enabled    = true
  }
}

resource "aws_api_gateway_integration" "lambda_integration" {
  for_each                = toset(["POST", "GET", "PATCH", "PUT", "DELETE"])
  rest_api_id             = aws_api_gateway_rest_api.rest_api.id
  resource_id             = aws_api_gateway_method.proxy_method[each.key].resource_id
  http_method             = aws_api_gateway_method.proxy_method[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.main.invoke_arn
}

// OPTIONS FOR CORS ------------------------------------------------------------

resource "aws_api_gateway_method" "cors_options" {
  api_key_required = false
  http_method      = "OPTIONS"
  authorization    = "NONE"
  rest_api_id      = aws_api_gateway_rest_api.rest_api.id
  resource_id      = aws_api_gateway_resource.proxy_resource.id
}

resource "aws_api_gateway_integration" "cors_mock" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  resource_id = aws_api_gateway_method.cors_options.resource_id
  http_method = aws_api_gateway_method.cors_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" : "{\"statusCode\" : 200 }"
  }
}

resource "aws_api_gateway_method_response" "http_ok" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  resource_id = aws_api_gateway_resource.proxy_resource.id
  http_method = aws_api_gateway_method.cors_options.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
  depends_on = [aws_api_gateway_method.cors_options]
}

resource "aws_api_gateway_integration_response" "options_mock" {
  rest_api_id = aws_api_gateway_rest_api.rest_api.id
  resource_id = aws_api_gateway_resource.proxy_resource.id
  http_method = aws_api_gateway_method.cors_options.http_method
  status_code = aws_api_gateway_method_response.http_ok.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'*'",
    "method.response.header.Access-Control-Allow-Methods" = "'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  response_templates = {
    "application/json" = ""
  }
  depends_on = [aws_api_gateway_method_response.http_ok]
}

# STAGE AND DEPLOYMENY --------------------------------------------------------

resource "aws_api_gateway_deployment" "deployment" {
  rest_api_id       = aws_api_gateway_rest_api.rest_api.id
  stage_description = "Deployment at ${timestamp()}"

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_resource.proxy_resource,
    aws_api_gateway_method.proxy_method,
    aws_api_gateway_integration.lambda_integration,
    aws_api_gateway_integration.cors_mock,
  ]
}

resource "aws_api_gateway_stage" "stage" {
  depends_on = [aws_cloudwatch_log_group.execution_logs]

  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.rest_api.id
  deployment_id = aws_api_gateway_deployment.deployment.id

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access_logs.arn
    format = jsonencode({
      requestId : "$context.requestId",
      ip : "$context.identity.sourceIp",
      requestTime : "$context.requestTime",
      httpMethod : "$context.httpMethod",
      resourcePath : "$context.resourcePath",
      status : "$context.status",
      protocol : "$context.protocol",
      responseLength : "$context.responseLength",
      integrationLatency : "$context.integrationLatency",
      user : "$context.identity.user",
      apiKey : "$context.identity.apiKey",
      caller : "$context.identity.caller",
      userArn : "$context.identity.userArn",
      userAgent : "$context.identity.userAgent",
      accountId : "$context.identity.accountId",
      stage : "$context.stage",
      resourcePath : "$context.resourcePath",
      authorizerPrincipalId : "$context.authorizer.principalId",
      requestTimeEpoch : "$context.requestTimeEpoch",
      requestId : "$context.requestId",
      identitySourceIp : "$context.identity.sourceIp",
      identityAccessKey : "$context.identity.accessKey",
      identityCaller : "$context.identity.caller",
    })
  }
}
