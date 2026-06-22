variable "name_prefix" {
  description = "Prefix for resource names (e.g. pongapp-prod)."
  type        = string
}

variable "vpc_cidr" {
  type = string
}

variable "azs" {
  type = list(string)
}

variable "public_subnet_cidrs" {
  type = list(string)
}

variable "private_app_subnet_cidrs" {
  type = list(string)
}

variable "private_data_subnet_cidrs" {
  type = list(string)
}

variable "cluster_name" {
  description = "EKS cluster name used for Kubernetes subnet/VPC discovery tags."
  type        = string
  default     = "pongapp-prod"
}
