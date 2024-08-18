resource "aws_resourcegroups_group" "resourcegroup_app" {
  name = "${var.global_prefix}-${var.environment}"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        {
          Key    = "App"
          Values = [var.global_prefix]
        },
        {
          Key    = "Environment"
          Values = [var.environment]
        }
      ]
    })
  }
}

resource "aws_applicationinsights_application" "insights_app" {
  resource_group_name = aws_resourcegroups_group.resourcegroup_app.name
}
