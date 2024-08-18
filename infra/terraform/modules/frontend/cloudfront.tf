resource "aws_cloudfront_origin_access_identity" "identity" {
  comment = "Static CloudFront Origin Access Identity"
}

resource "aws_cloudfront_distribution" "main" {
  enabled      = true
  http_version = "http2"

  comment = "${var.global_prefix} ${var.environment} Frontend"

  origin {
    origin_id   = "origin-bucket-${aws_s3_bucket.main.id}"
    domain_name = aws_s3_bucket.main.bucket_regional_domain_name

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.identity.cloudfront_access_identity_path
    }
  }

  default_root_object = "index.html"

  custom_error_response {
    error_code            = "404"
    error_caching_min_ttl = "0"
    response_code         = "200"
    response_page_path    = "/index.html"
  }

  default_cache_behavior {

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD", "OPTIONS"]

    forwarded_values {
      query_string = false

      headers = [
        "Origin",
        "Access-Control-Request-Headers",
        "Access-Control-Request-Method"
      ]

      cookies {
        forward = "all"
      }
    }

    target_origin_id = "origin-bucket-${aws_s3_bucket.main.id}"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1"
  }

  aliases = []
}

