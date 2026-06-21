# ---------------------------------------------------------------------------
# Keyless CI auth: GitHub Actions assumes an IAM role via OIDC (no static keys).
# This module creates the OIDC provider and a narrow CI role that can push to ECR.
# The broader deploy role (ECS deploy + PassRole) is created with the ECS module,
# where the task role ARNs it must reference exist.
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = { Name = "${var.name_prefix}-github-oidc" }
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
  subject_main      = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/main"
}

# ---- CI role: build & push images to ECR (push job runs on main only) ----
data "aws_iam_policy_document" "ci_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.subject_main]
    }
  }
}

resource "aws_iam_role" "ci" {
  name               = "${var.name_prefix}-gha-ci"
  assume_role_policy = data.aws_iam_policy_document.ci_trust.json
  tags               = { Name = "${var.name_prefix}-gha-ci" }
}

data "aws_iam_policy_document" "ci_ecr" {
  # ECR auth token is account-scoped and must target "*".
  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = var.ecr_repo_arns
  }
}

resource "aws_iam_role_policy" "ci_ecr" {
  name   = "ecr-push"
  role   = aws_iam_role.ci.id
  policy = data.aws_iam_policy_document.ci_ecr.json
}
