locals {
  root = "${path.module}/../../../.."
  // the URL without the 'wss://' and '/prod' parts
  ws_api_url = element(split("/", replace(var.api_gateway_websocket_url, "wss://", "")), 0)
}
