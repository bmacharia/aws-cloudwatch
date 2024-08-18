locals {
  root       = "${path.module}/../../../.."
  email_list = var.email_addresses != "" ? split(",", var.email_addresses) : []
}

