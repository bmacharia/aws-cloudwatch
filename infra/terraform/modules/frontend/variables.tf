variable "global_prefix" {

}

variable "environment" {

}

variable "global_suffix" {

}

variable "basic_auth_enabled" {
  description = "Enable or disable basic authentication"
  type        = bool
  default     = false
}

variable "nodejs_runtime" {

}

variable "basic_auth_username" {
  description = "Username for basic authentication"
  type        = string
}

variable "basic_auth_password" {
  description = "Password for basic authentication"
  type        = string
}
