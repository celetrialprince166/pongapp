output "oidc_provider_arn" {
  value = local.oidc_provider_arn
}

output "ci_role_arn" {
  description = "ARN of the CI role GitHub Actions assumes to push images."
  value       = aws_iam_role.ci.arn
}
