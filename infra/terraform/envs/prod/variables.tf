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

# ---- network ----
variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Availability zones to span (2 for HA)."
  type        = list(string)
  default     = ["eu-west-1a", "eu-west-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets (ALB, NAT)."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs for private application subnets (ECS Fargate tasks)."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "private_data_subnet_cidrs" {
  description = "CIDRs for private data subnets (RDS, ElastiCache)."
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

# ---- ci/cd (github oidc) ----
variable "github_org" {
  description = "GitHub account/org that owns the repo (OIDC subject)."
  type        = string
  default     = "celetrialprince166"
}

variable "github_repo" {
  description = "GitHub repository name (OIDC subject)."
  type        = string
  default     = "pongapp"
}
