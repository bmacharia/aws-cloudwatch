terraform {
  required_version = "=1.6.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31.0"
    }
  }

  backend "s3" {
    key            = "dev.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region              = local.region
  allowed_account_ids = [var.aws_account_id]
  default_tags {
    tags = local.default_tags
  }
}

provider "aws" {
  region = "us-east-1"
  alias  = "us-east-1"
  default_tags {
    tags = local.default_tags
  }
}

module "frontend" {
  source        = "../../modules/frontend"
  global_prefix = local.global_prefix
  environment   = local.environment
  global_suffix = var.project_suffix
  providers = {
    aws.us-east-1 = aws.us-east-1
  }
}

module "database" {
  source        = "../../modules/backend/database"
  global_prefix = local.global_prefix
  environment   = local.environment
}


module "api_rest" {
  source                    = "../../modules/backend/api-rest"
  global_prefix             = local.global_prefix
  environment               = local.environment
  nodejs_runtime            = local.nodejs_runtime
  table_arn_repositories    = module.database.table_arn_repositories
  table_name_repositories   = module.database.table_name_repositories
  table_arn_connections     = module.database.table_arn_connections
  table_name_connections    = module.database.table_name_connections
  evidently_project_arn     = module.evidently.evidently_project_arn
  lambda_layer_arn          = module.shared.lambda_layer_arn
  lambda_insights_layer_arn = local.lambda_insights_layer_arn
  depends_on                = [module.shared]
}

module "api_websocket" {
  source                    = "../../modules/backend/api-websocket"
  global_prefix             = local.global_prefix
  environment               = local.environment
  nodejs_runtime            = local.nodejs_runtime
  table_arn_repositories    = module.database.table_arn_repositories
  table_name_repositories   = module.database.table_name_repositories
  table_arn_connections     = module.database.table_arn_connections
  table_name_connections    = module.database.table_name_connections
  lambda_layer_arn          = module.shared.lambda_layer_arn
  lambda_insights_layer_arn = local.lambda_insights_layer_arn
  depends_on                = [module.shared]
  evidently_project_arn     = module.evidently.evidently_project_arn
}

module "evidently" {
  source        = "../../modules/evidently"
  global_prefix = local.global_prefix
  environment   = local.environment
  depends_on    = [module.shared]
}

module "alarms" {
  source                    = "../../modules/alarms"
  global_prefix             = local.global_prefix
  environment               = local.environment
  rest_lambda_function_name = module.api_rest.lambda_function_name
  nodejs_runtime            = local.nodejs_runtime
  lambda_layer_arn          = module.shared.lambda_layer_arn
  depends_on                = [module.shared]
  discord_webhook_url       = var.discord_webhook_url
  lambda_insights_layer_arn = local.lambda_insights_layer_arn
  email_addresses           = var.alerting_emails
  evidently_project_arn     = module.evidently.evidently_project_arn
  rest_api_name = module.api_rest.rest_api_name
  table_name_repositories = module.database.table_name_repositories
}

module "synthetics" {
  source               = "../../modules/synthetics"
  global_prefix        = local.global_prefix
  environment          = local.environment
  frontend_url         = module.frontend.cf_url
  alarms_sns_topic_arn = module.alarms.alarms_sns_topic_arn
  depends_on           = [module.shared]
  backend_url          = module.api_rest.apigw_url
  # The AWS Free tier includes 100 executions each month
  # With this cron, we'll exactly use the 100 executions
  # 5 canaries * 4 weeks * 5 days = 100 executions
  cron = "0 6 ? * MON-FRI *"
  # The canaries can be found in the backend folder
  # at backend/lambda/canaries/nodejs/node_modules
  # You don't need to provide the `canary_` prefix
  enabled_canaries = ["api", "heart", "journey", "links", "visual"]
  rum_monitor_name = module.rum.app_monitor_name
  global_suffix    = var.project_suffix
}

module "exporter" {
  source                = "../../modules/backend/exporter"
  environment           = local.environment
  apigw_rest_url        = module.api_rest.apigw_url
  apigw_ws_url          = module.api_websocket.apigw_url
  cf_url                = module.frontend.cf_url
  rum_identity_pool_arn = module.rum.identity_pool_arn
  rum_guest_role_arn    = module.rum.guest_role_arn
  rum_app_monitor_id    = module.rum.app_monitor_id
}

module "shared" {
  source         = "../../modules/backend/shared"
  global_prefix  = local.global_prefix
  environment    = local.environment
  nodejs_runtime = local.nodejs_runtime
}

module "traffic_generator" {
  source                    = "../../modules/backend/traffic-generator"
  global_prefix             = local.global_prefix
  environment               = local.environment
  nodejs_runtime            = local.nodejs_runtime
  urls                      = [module.api_rest.apigw_url]
  evidently_project_arn     = module.evidently.evidently_project_arn
  lambda_layer_arn          = module.shared.lambda_layer_arn
  lambda_insights_layer_arn = local.lambda_insights_layer_arn
  depends_on                = [module.shared]
}

module "rum" {
  source          = "../../modules/rum"
  global_prefix   = local.global_prefix
  environment     = local.environment
  frontend_domain = module.frontend.cf_url
  depends_on      = [module.frontend]
}

module "notification" {
  source                                  = "../../modules/notification"
  global_prefix                           = local.global_prefix
  environment                             = local.environment
  nodejs_runtime                          = local.nodejs_runtime
  lambda_layer_arn                        = module.shared.lambda_layer_arn
  depends_on                              = [module.shared]
  connection_table_name                   = module.database.table_name_connections
  repository_table_name                   = module.database.table_name_repositories
  repository_table_arn                    = module.database.table_arn_repositories
  connection_table_arn                    = module.database.table_arn_connections
  api_gateway_websocket_arn               = module.api_websocket.apigw_stage_arn
  websocket_api_connection_management_arn = module.api_websocket.websocket_api_connection_management_arn
  api_gateway_websocket_url               = module.api_websocket.apigw_url
  lambda_insights_layer_arn               = local.lambda_insights_layer_arn
}

module "application_insights" {
  source        = "../../modules/application-insights"
  global_prefix = local.global_prefix
  environment   = local.environment
  depends_on = [
    module.api_rest,
    module.api_websocket,
    module.frontend,
    module.database,
    module.shared,
    module.alarms,
    module.synthetics,
    module.exporter,
    module.traffic_generator,
    module.rum,
    module.notification
  ]
}

module "anomaly" {
  count                      = local.enable_anomaly_detection ? 1 : 0
  source                     = "../../modules/anomaly"
  global_prefix              = local.global_prefix
  environment                = local.environment
  alarms_sns_topic_arn       = module.alarms.alarms_sns_topic_arn
  rest_lambda_log_group_name = module.api_rest.lambda_log_group_name
}
