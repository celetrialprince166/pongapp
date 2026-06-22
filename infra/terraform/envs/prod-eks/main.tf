locals {
  name_prefix  = "${var.project}-${var.environment}" # pongapp-prod
  cluster_name = var.cluster_name
}

# ---------------------------------------------------------------------------
# Own VPC for EKS (separate from the ECS root's VPC for clean isolation; the two
# roots never peer, so an independent CIDR keeps diagrams/route tables unambiguous).
# ---------------------------------------------------------------------------
module "network" {
  source = "../../modules/network"

  name_prefix               = local.name_prefix
  vpc_cidr                  = var.vpc_cidr
  azs                       = var.azs
  public_subnet_cidrs       = var.public_subnet_cidrs
  private_app_subnet_cidrs  = var.private_app_subnet_cidrs
  private_data_subnet_cidrs = var.private_data_subnet_cidrs
  cluster_name              = local.cluster_name # EKS subnet/VPC discovery tags
}

# ---------------------------------------------------------------------------
# Existing ECR repositories (created + owned by the ECS root, hold live images).
# Read-only lookup: never managed here, so no name-collision / destroy risk.
# ---------------------------------------------------------------------------
data "aws_ecr_repository" "backend" {
  name = "pongapp-backend"
}

data "aws_ecr_repository" "frontend" {
  name = "pongapp-frontend"
}

# ---------------------------------------------------------------------------
# EKS cluster (control plane + managed node group + core addons)
# ---------------------------------------------------------------------------
module "eks_cluster" {
  source = "../../modules/eks-cluster"

  cluster_name       = local.cluster_name
  cluster_version    = var.eks_cluster_version
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_app_subnet_ids

  node_instance_types = var.eks_node_instance_types
  node_min_size       = var.eks_node_min_size
  node_max_size       = var.eks_node_max_size
  node_desired_size   = var.eks_node_desired_size
}

# ---------------------------------------------------------------------------
# IRSA roles (reuse the official iam-role-for-service-accounts-eks submodule).
# Trust policies reference the cluster's OIDC provider; created AFTER the cluster.
# ---------------------------------------------------------------------------
module "irsa_lb_controller" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name                              = "${local.name_prefix}-aws-lb-controller"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks_cluster.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
}

module "irsa_ebs_csi" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${local.name_prefix}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks_cluster.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

# EBS CSI driver addon, wired to its IRSA role. Standalone (not in the eks module's
# cluster_addons) to avoid a cluster -> irsa -> cluster dependency cycle.
resource "aws_eks_addon" "ebs_csi" {
  cluster_name             = module.eks_cluster.cluster_name
  addon_name               = "aws-ebs-csi-driver"
  service_account_role_arn = module.irsa_ebs_csi.iam_role_arn

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
}
