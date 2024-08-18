resource "aws_s3_bucket" "main" {
  bucket        = "${var.global_prefix}-${var.environment}-synthetics-${var.global_suffix}"
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.main.bucket
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "local_file" "input" {
  for_each = { for idx, val in local.canaries : idx => val }
  filename = "${local.root}/backend/dist/${each.value}.zip"
}

resource "aws_s3_object" "canary" {
  for_each = { for idx, val in local.canaries : idx => val }

  bucket       = aws_s3_bucket.main.bucket
  key          = "${each.value}.zip"
  content_type = "application/zip"
  source       = data.local_file.input[each.key].filename
  etag         = data.local_file.input[each.key].content_md5
}

# Results of our Canary runs will also be stored in this bucket
# Within the path `canary/`
# Let's expire files in this bucket after 30 days to avoid
# unnecessary storage costs

resource "aws_s3_bucket_lifecycle_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "ExpireCanaryFiles"
    status = "Enabled"
    filter {
      prefix = "canary/"
    }

    expiration {
      days = 30
    }
  }
}