resource "aws_iam_role" "synthetics_canary_role" {
  name               = "${var.global_prefix}-${var.environment}-synthetics-canary"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "synthetics_canary_policy_attachment" {
  role       = aws_iam_role.synthetics_canary_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "synthetics_canary_policy" {
  name   = "${var.global_prefix}-${var.environment}-synthetics-canary-policy"
  role   = aws_iam_role.synthetics_canary_role.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:GetBucketAcl",
          "s3:ListAllMyBuckets",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBuckets",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "cloudwatch:PutMetricData",
          "xray:PutTraceSegments"
        ],
        Resource = "*"
      }
    ]
  })
}