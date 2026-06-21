output "deploy_role_arn" {
  description = "Set as the role-to-assume in the GitHub Actions deploy workflow."
  value       = aws_iam_role.deploy.arn
}
