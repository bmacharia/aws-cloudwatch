# Our dependency file will be created externally, without involving Terraform
# This is done to avoid cyclic dependencies between the packaging process
# and the Terraform state management

data "local_file" "archive" {
  filename = "${local.root}/backend/dist/dependencies.zip"
}

resource "aws_lambda_layer_version" "dependencies" {
  filename            = data.local_file.archive.filename
  source_code_hash    = fileexists(data.local_file.archive.filename) ? filebase64sha256(data.local_file.archive.filename) : ""
  layer_name          = "${var.global_prefix}-${var.environment}-dependencies"
  compatible_runtimes = [var.nodejs_runtime]
}
