output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  value = module.eks.cluster_certificate_authority_data
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN for IRSA role trust policies."
  value       = module.eks.oidc_provider_arn
}

output "cluster_version" {
  value = module.eks.cluster_version
}

output "node_security_group_id" {
  value = module.eks.node_security_group_id
}
