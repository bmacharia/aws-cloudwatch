resource "aws_s3_bucket" "main" {
  bucket = "${var.global_prefix}-${var.environment}-frontend-${var.global_suffix}"
  force_destroy = true
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

data "aws_iam_policy_document" "cloudfront_access_policy" {
  statement {
    sid    = "CloudFrontAccess"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:List*",
    ]

    resources = [
      "arn:aws:s3:::${aws_s3_bucket.main.id}",
      "arn:aws:s3:::${aws_s3_bucket.main.id}/*",
    ]

    principals {
      type        = "AWS"
      identifiers = ["${aws_cloudfront_origin_access_identity.identity.iam_arn}"]
    }
  }
}

resource "aws_s3_bucket_policy" "cloudfront_access_policy" {
  bucket = aws_s3_bucket.main.id
  policy = data.aws_iam_policy_document.cloudfront_access_policy.json
}
