# ---------------------------------------------------------------------------
# EKS control plane + one managed node group + core addons.
# Wraps the registry module so we inherit current best-practice IAM/OIDC wiring
# instead of hand-rolling the control plane, node role, and access entries.
# ---------------------------------------------------------------------------

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0" # v21 supports AWS provider >= 6.15 (project pins aws ~> 6.0)

  name               = var.cluster_name
  kubernetes_version = var.cluster_version

  # CI and local kubectl reach the API over the public endpoint; private stays on
  # for in-VPC traffic (nodes, future bastion).
  endpoint_public_access  = true
  endpoint_private_access = true

  enable_irsa = true

  # API access entries (no aws-auth configmap); add the apply principal as admin
  # so it can kubectl immediately after apply.
  authentication_mode                      = "API_AND_CONFIG_MAP"
  enable_cluster_creator_admin_permissions = true

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids
  # Control-plane ENIs also land in the private-app subnets (kept private; public
  # access is via the managed EKS endpoint, not these ENIs).
  control_plane_subnet_ids = var.private_subnet_ids

  # vpc-cni / coredns / kube-proxy are managed here. aws-ebs-csi-driver is created
  # as a standalone aws_eks_addon in the env root: it needs an IRSA role whose trust
  # policy references THIS cluster's OIDC provider, and wiring that role back into
  # this module would form a cluster->irsa->cluster dependency cycle.
  addons = {
    # vpc-cni and kube-proxy MUST install before the managed node group joins.
    # Otherwise nodes boot with no CNI, never reach Ready ("cni plugin not
    # initialized"), and the node group fails with NodeCreationFailure.
    vpc-cni = {
      before_compute = true
      most_recent    = true
    }
    kube-proxy = {
      before_compute = true
      most_recent    = true
    }
    # coredns needs Ready nodes to schedule, so it installs after compute.
    coredns = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    default = {
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = var.node_instance_types
      min_size       = var.node_min_size
      max_size       = var.node_max_size
      desired_size   = var.node_desired_size
      subnet_ids     = var.private_subnet_ids
    }
  }

  tags = {
    Cluster = var.cluster_name
  }
}
