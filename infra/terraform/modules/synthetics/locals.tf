locals {
  root            = "${path.module}/../../../.."
  basic_auth_user = "cloudwatch-pro"
  basic_auth_pass = "861b33f8-e322-6a8c-e90c-e600c1dc6e3e"
  # https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Library_nodejs_puppeteer.html
  # we've experienced issues with the latest 2 runtimes with Visual Monitoring
  # please downgrade this to 6.2 if you experience the same issues!
  synthetics_runtime = "syn-nodejs-puppeteer-8.0"
  canaries           = [for value in var.enabled_canaries : "canary_${value}"]
}

