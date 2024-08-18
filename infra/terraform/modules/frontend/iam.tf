resource "aws_iam_role" "lambda_edge" {
  name               = "${var.global_prefix}-${var.environment}-lambda-edge"
  assume_role_policy = data.aws_iam_policy_document.edge_assume.json
}

data "aws_iam_policy_document" "edge_assume" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "Service"
      identifiers = [
        "lambda.amazonaws.com",
        "edgelambda.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role_policy_attachment" "edge" {
  policy_arn = aws_iam_policy.static_edge.arn
  role       = aws_iam_role.lambda_edge.name
}

resource "aws_iam_policy" "static_edge" {
  name   = "${var.global_prefix}-${var.environment}-static-edge"
  policy = data.aws_iam_policy_document.edge.json
}

data "aws_iam_policy_document" "edge" {
  statement {
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]

    resources = [
      "arn:aws:logs:*:*:log-group:*:*",
    ]
  }
}
