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

# ---- app infra ----
output "alb_dns_name" {
  description = "Public app entry point (frontend)."
  value       = module.alb.alb_dns_name
}

output "ecs_cluster_name" {
  value = module.ecs_cluster.cluster_name
}

output "rds_address" {
  value = module.rds.address
}

output "redis_endpoint" {
  value = module.elasticache.primary_endpoint_address
}

output "backend_service_discovery_name" {
  description = "Internal DNS name the frontend uses to reach the backend."
  value       = "backend.${module.cloudmap.namespace_name}"
}

output "github_deploy_role_arn" {
  description = "Set as the role-to-assume in the GitHub Actions deploy workflow."
  value       = module.github_deploy.deploy_role_arn
}
