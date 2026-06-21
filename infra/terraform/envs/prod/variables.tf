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

# ---- app images ----
variable "frontend_image_tag" {
  description = "Frontend image tag to deploy (CI overrides with the git SHA)."
  type        = string
  default     = "latest"
}

variable "backend_image_tag" {
  description = "Backend image tag to deploy (CI overrides with the git SHA)."
  type        = string
  default     = "latest"
}

# ---- app sizing (cost-optimized defaults) ----
variable "frontend_cpu" {
  description = "Frontend Fargate CPU units."
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Frontend Fargate memory (MiB)."
  type        = number
  default     = 512
}

variable "backend_cpu" {
  description = "Backend Fargate CPU units."
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Backend Fargate memory (MiB)."
  type        = number
  default     = 1024
}

variable "frontend_desired_count" {
  description = "Number of frontend tasks."
  type        = number
  default     = 2
}

variable "backend_desired_count" {
  description = "Number of backend tasks."
  type        = number
  default     = 2
}

variable "bake_time_in_minutes" {
  description = "Blue/green bake time before completing traffic shift."
  type        = number
  default     = 5
}

# ---- data tier ----
variable "rds_multi_az" {
  description = "Enable RDS Multi-AZ (off by default for cost)."
  type        = bool
  default     = false
}

variable "app_url" {
  description = "Public app URL for CSRF/CORS allowlists (set to the ALB URL post-deploy)."
  type        = string
  default     = "*"
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
