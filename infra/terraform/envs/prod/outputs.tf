# ---- network ----
output "vpc_id" {
  value = module.network.vpc_id
}

output "private_app_subnet_ids" {
  value = module.network.private_app_subnet_ids
}

output "private_data_subnet_ids" {
  value = module.network.private_data_subnet_ids
}

output "public_subnet_ids" {
  value = module.network.public_subnet_ids
}

# ---- ecr ----
output "ecr_repository_urls" {
  description = "Push targets for CI."
  value       = module.ecr.repository_urls
}

# ---- ci/cd ----
output "github_ci_role_arn" {
  description = "Set as the role-to-assume in the GitHub Actions CI workflow."
  value       = module.github_oidc.ci_role_arn
}

output "github_oidc_provider_arn" {
  value = module.github_oidc.oidc_provider_arn
}
