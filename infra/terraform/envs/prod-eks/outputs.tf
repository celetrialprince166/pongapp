# ---- network ----
output "vpc_id" {
  value = module.network.vpc_id
}

output "private_app_subnet_ids" {
  value = module.network.private_app_subnet_ids
}

output "public_subnet_ids" {
  value = module.network.public_subnet_ids
}

# ---- ecr (read-only; repos owned by the ECS root) ----
output "ecr_backend_repository_url" {
  description = "ECR backend repo URL for the kustomize overlay images: block."
  value       = data.aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "ECR frontend repo URL for the kustomize overlay images: block."
  value       = data.aws_ecr_repository.frontend.repository_url
}

# ---- eks cluster ----
output "eks_cluster_name" {
  value = module.eks_cluster.cluster_name
}

output "eks_cluster_endpoint" {
  value = module.eks_cluster.cluster_endpoint
}

output "eks_cluster_version" {
  value = module.eks_cluster.cluster_version
}

output "eks_cluster_certificate_authority_data" {
  value     = module.eks_cluster.cluster_certificate_authority_data
  sensitive = true
}

output "eks_oidc_provider_arn" {
  value = module.eks_cluster.oidc_provider_arn
}

output "eks_node_security_group_id" {
  value = module.eks_cluster.node_security_group_id
}

# ---- IRSA roles (post-apply wiring) ----
output "aws_lb_controller_role_arn" {
  description = "IRSA role ARN for the AWS Load Balancer Controller Helm install (serviceAccount kube-system/aws-load-balancer-controller)."
  value       = module.irsa_lb_controller.iam_role_arn
}

output "ebs_csi_role_arn" {
  description = "IRSA role ARN bound to the aws-ebs-csi-driver addon."
  value       = module.irsa_ebs_csi.iam_role_arn
}

# ---- post-apply helper ----
output "update_kubeconfig_command" {
  description = "Run this to point kubectl at the new cluster."
  value       = "aws eks update-kubeconfig --name ${module.eks_cluster.cluster_name} --region ${var.aws_region}"
}
