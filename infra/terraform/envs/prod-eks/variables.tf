variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "eu-west-1"
}

variable "project" {
  description = "Project name; used as a prefix and tag."
  type        = string
  default     = "pongapp"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "prod"
}

# ---- network (own VPC, distinct CIDR from the ECS root) ----
variable "vpc_cidr" {
  description = "CIDR block for the EKS VPC (distinct from the ECS VPC)."
  type        = string
  default     = "10.1.0.0/16"
}

variable "azs" {
  description = "Availability zones to span (2 for HA)."
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets (ALB, NAT)."
  type        = list(string)
  default     = ["10.1.0.0/24", "10.1.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs for private application subnets (EKS nodes)."
  type        = list(string)
  default     = ["10.1.10.0/24", "10.1.11.0/24"]
}

variable "private_data_subnet_cidrs" {
  description = "CIDRs for private data subnets (in-cluster Postgres EBS volumes live on nodes; kept for module/subnet parity)."
  type        = list(string)
  default     = ["10.1.20.0/24", "10.1.21.0/24"]
}

# ---- eks cluster ----
variable "cluster_name" {
  description = "EKS cluster name (also drives the kubernetes.io/cluster subnet tags)."
  type        = string
  default     = "pongapp-prod"
}

variable "eks_cluster_version" {
  description = "EKS Kubernetes version."
  type        = string
  default     = "1.32"
}

variable "eks_node_instance_types" {
  description = "Instance types for the managed node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "eks_node_min_size" {
  type    = number
  default = 2
}

variable "eks_node_max_size" {
  type    = number
  default = 3
}

variable "eks_node_desired_size" {
  type    = number
  default = 2
}
