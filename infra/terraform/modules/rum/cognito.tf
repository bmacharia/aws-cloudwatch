resource "aws_cognito_identity_pool" "rum_identity_pool" {
  identity_pool_name               = "${var.global_prefix}-${var.environment}-rum"
  allow_unauthenticated_identities = true
  allow_classic_flow               = true
}

resource "aws_iam_role" "rum_guest_role" {
  name = "${var.global_prefix}-${var.environment}-rum-guest-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.rum_identity_pool.id
          },
          "ForAnyValue:StringLike" : {
            "cognito-identity.amazonaws.com:amr" : "unauthenticated"
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "rum_guest_policy" {
  name        = "${var.global_prefix}-${var.environment}-rum-guest-policy"
  description = "Policy for RUM guest role"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "rum:PutRumEvents"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rum_guest_policy_attachment" {
  role       = aws_iam_role.rum_guest_role.name
  policy_arn = aws_iam_policy.rum_guest_policy.arn
}

resource "aws_cognito_identity_pool_roles_attachment" "rum_identity_pool_roles_attachment" {
  identity_pool_id = aws_cognito_identity_pool.rum_identity_pool.id

  roles = {
    "unauthenticated" = aws_iam_role.rum_guest_role.arn
  }
}
