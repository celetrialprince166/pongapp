variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "pongapp-prod"
}

variable "cluster_version" {
  description = "Kubernetes control-plane version."
  type        = string
  default     = "1.32"
}

variable "vpc_id" {
  description = "VPC the cluster lives in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private-app subnets for the managed node group (and control-plane ENIs)."
  type        = list(string)
}

variable "node_instance_types" {
  description = "Instance types for the managed node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 3
}

variable "node_desired_size" {
  type    = number
  default = 2
}
