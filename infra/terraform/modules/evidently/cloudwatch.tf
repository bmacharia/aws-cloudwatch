resource "aws_cloudwatch_log_group" "evidently" {
  name = "/aws/cloudwatch/${var.global_prefix}/${var.environment}/evidently"
}

resource "aws_evidently_project" "main" {
  name        = "${var.global_prefix}-${var.environment}"
  description = "Learning about feature flags and A/B testing!"

  data_delivery {
    cloudwatch_logs {
      log_group = aws_cloudwatch_log_group.evidently.name
    }
  }
}

# ------------------------------
# FEATURE FLAGS ----------------

# Show or hide stars
resource "aws_evidently_feature" "with_stars" {
  name              = "show_stars"
  description       = "Show github stars on the page or not"
  project           = aws_evidently_project.main.name
  default_variation = "false"

  variations {
    name = "false"
    value {
      bool_value = false
    }
  }

  variations {
    name = "true"
    value {
      bool_value = true
    }
  }

  lifecycle {
    ignore_changes = [default_variation]
  }
}

# Show or hide search bar
resource "aws_evidently_feature" "with_searchbar" {
  name              = "show_searchbar"
  description       = "Show search bar on the page or not"
  project           = aws_evidently_project.main.name
  default_variation = "false"

  variations {
    name = "false"
    value {
      bool_value = false
    }
  }

  variations {
    name = "true"
    value {
      bool_value = true
    }
  }

  lifecycle {
    ignore_changes = [default_variation]
  }
}

# Generate fake traffic via Lambda
resource "aws_evidently_feature" "with_traffic_generator" {
  name              = "generate_traffic"
  description       = "Generate fake traffic via Lambda"
  project           = aws_evidently_project.main.name
  default_variation = "none"

  variations {
    name = "none"
    value {
      string_value = "none"
    }
  }

  variations {
    name = "low"
    value {
      string_value = "low"
    }
  }

  variations {
    name = "medium"
    value {
      string_value = "medium"
    }
  }

  variations {
    name = "high"
    value {
      string_value = "high"
    }
  }

  lifecycle {
    ignore_changes = [default_variation]
  }
}

# Toggling Errors into our functions
resource "aws_evidently_feature" "with_errors" {
  name              = "generate_errors"
  description       = "Adding manual errors to our functions"
  project           = aws_evidently_project.main.name
  default_variation = "none"

  variations {
    name = "none"
    value {
      string_value = "none"
    }
  }

  variations {
    name = "github-api"
    value {
      string_value = "github-api"
    }
  }

  variations {
    name = "websockets"
    value {
      string_value = "websockets"
    }
  }

  variations {
    name = "rest-api"
    value {
      string_value = "rest-api"
    }
  }

  lifecycle {
    ignore_changes = [default_variation]
  }
}

// ------------------------------
// SEGMENTS ---------------------

// Device Types

resource "aws_evidently_segment" "mobile_users" {
  description = "Mobile Users"
  name        = "${var.environment}-device-mobile"
  pattern     = <<JSON
    {
        "deviceType": [ "mobile" ]
    }
    JSON
}

resource "aws_evidently_segment" "tablet_users" {
  description = "Tablet Users"
  name        = "${var.environment}-device-tablet"
  pattern     = <<JSON
    {
        "deviceType": [ "tablet" ]
    }
    JSON
}

resource "aws_evidently_segment" "desktop_users" {
  description = "Desktop Users"
  name        = "${var.environment}-device-desktop"
  pattern     = <<JSON
    {
      "$or": [
        {"deviceType": [ { "anything-but": [ "mobile" ] } ]},
        {"deviceType": [ { "anything-but": [ "tablet" ] } ]}
      ]
    }
    JSON
}

// Operating Systems

resource "aws_evidently_segment" "ios_users" {
  description = "iOS Users"
  name        = "${var.environment}-os-ios"
  pattern     = <<JSON
    {
        "deviceModel": [ "iOS" ]
    }
    JSON
}

resource "aws_evidently_segment" "android_users" {
  description = "Android Users"
  name        = "${var.environment}-os-android"
  pattern     = <<JSON
    {
        "deviceModel": [ "Android" ]
    }
    JSON
}

// Browsers

resource "aws_evidently_segment" "safari_users" {
  description = "Safari Users"
  name        = "${var.environment}-browser-safari"
  pattern     = <<JSON
    {
        "browser": [ "Safari" ]
    }
    JSON
}

resource "aws_evidently_segment" "firefox_users" {
  description = "Firefox Users"
  name        = "${var.environment}-browser-firefox"
  pattern     = <<JSON
    {
        "browser": [ "Firefox" ]
    }
    JSON
}

resource "aws_evidently_segment" "anything_but_safari" {
  description = "Chrome Users"
  name        = "${var.environment}-browser-not-safari"
  pattern     = <<JSON
    {
        "browser": [
          {
            "anything-but": [ "Safari" ]
          }
        ]
    }
    JSON
}

# just for IaC demo purposes
# create your launches & experiments within the AWS console
resource "aws_evidently_launch" "show_searchbar_launch" {
  count   = local.should_launch_searchbar ? 1 : 0
  name    = "launch_searchbar"
  project = aws_evidently_project.main.name

  groups {
    feature   = aws_evidently_feature.with_searchbar.name
    name      = "hide_searchbar"
    variation = "false"
  }

  groups {
    feature   = aws_evidently_feature.with_searchbar.name
    name      = "show_searchbar"
    variation = "true"
  }

  metric_monitors {
    metric_definition {
      name          = "UseSearchBarRemote"
      entity_id_key = "userDetails.userId"
      value_key     = "eventDetails.count"
    }
  }

  metric_monitors {
    metric_definition {
      name          = "AddFavorite"
      entity_id_key = "userDetails.userId"
      value_key     = "eventDetails.count"
    }
  }

  scheduled_splits_config {
    steps {
      group_weights = {
        "hide_searchbar" = 100000
        "show_searchbar" = 0
      }
      # we'll never show the search bar to Safari users
      segment_overrides {
        evaluation_order = 1
        segment          = aws_evidently_segment.safari_users.name

        weights = {
          "hide_searchbar" = 100000
          "show_searchbar" = 0
        }
      }
      start_time = timeadd(timestamp(), format("-%dm", local.searchbar_timebetween_minutes))
    }
    steps {
      group_weights = {
        "hide_searchbar" = 50000
        "show_searchbar" = 50000
      }
      # we'll never show the search bar to Safari users
      segment_overrides {
        evaluation_order = 2
        segment          = aws_evidently_segment.safari_users.name

        weights = {
          "hide_searchbar" = 100000
          "show_searchbar" = 0
        }
      }
      start_time = timeadd(timestamp(), format("%dm", local.searchbar_timebetween_minutes))
    }
    steps {
      group_weights = {
        "hide_searchbar" = 0
        "show_searchbar" = 100000
      }
      # we'll never show the search bar to Safari users
      segment_overrides {
        evaluation_order = 2
        segment          = aws_evidently_segment.safari_users.name

        weights = {
          "hide_searchbar" = 100000
          "show_searchbar" = 0
        }
      }
      start_time = timeadd(timestamp(), format("%dm", local.searchbar_timebetween_minutes * 2))
    }
  }
}
