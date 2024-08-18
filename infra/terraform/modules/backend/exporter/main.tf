data "aws_region" "current" {}

resource "null_resource" "export_url" {
  triggers = {
    timestamp = timestamp()
  }

  provisioner "local-exec" {
    command = <<EOT
      chmod +x ${path.module}/write-env.sh
      ${path.module}/write-env.sh "${var.environment}" "NEXT_PUBLIC_ENVIRONMENT" "${var.environment}"
      ${path.module}/write-env.sh "${var.environment}" "NEXT_PUBLIC_AWS_REGION" "${data.aws_region.current.name}"
      ${path.module}/write-env.sh "${var.environment}" "NEXT_PUBLIC_APIGW_REST" "${var.apigw_rest_url}"
      ${path.module}/write-env.sh "${var.environment}" "NEXT_PUBLIC_APIGW_WS" "${var.apigw_ws_url}"
      ${path.module}/write-env.sh "${var.environment}" "NEXT_PUBLIC_RUM_IDENTITY_POOL_ARN" "${var.rum_identity_pool_arn}"
      ${path.module}/write-env.sh "${var.environment}" "NEXT_PUBLIC_RUM_GUEST_ROLE_ARN" "${var.rum_guest_role_arn}"
      ${path.module}/write-env.sh "${var.environment}" "NEXT_PUBLIC_RUM_MONITOR_ID" "${var.rum_app_monitor_id}"
    EOT
  }
}