variable "name_prefix" {
  description = "Prefix for resource names (e.g. pongapp-prod)."
  type        = string
}

variable "service_name" {
  description = "Short service name (also the container name), e.g. frontend / backend."
  type        = string
}

variable "aws_region" {
  description = "AWS region (for the awslogs driver)."
  type        = string
}

variable "cluster_arn" {
  description = "ECS cluster ARN."
  type        = string
}

variable "image_repo_url" {
  description = "ECR repository URL for this service's image."
  type        = string
}

variable "image_tag" {
  description = "Image tag to deploy (CI overrides with the git SHA)."
  type        = string
  default     = "latest"
}

variable "container_port" {
  description = "Container listening port."
  type        = number
}

variable "cpu" {
  description = "Fargate task CPU units."
  type        = number
}

variable "memory" {
  description = "Fargate task memory (MiB)."
  type        = number
}

variable "desired_count" {
  description = "Number of tasks to run."
  type        = number
  default     = 2
}

variable "subnet_ids" {
  description = "Private app subnet ids for the tasks."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group id for the tasks."
  type        = string
}

variable "environment" {
  description = "Plain environment variables (name -> value)."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secret env vars (env var name -> Secrets Manager ARN/valueFrom)."
  type        = map(string)
  default     = {}
}

variable "secret_arns" {
  description = "Distinct secret ARNs the execution role may read (for the inline policy)."
  type        = list(string)
  default     = []
}

variable "health_check_command" {
  description = "Container healthCheck command (CMD-SHELL form); null to omit."
  type        = list(string)
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 14
}

variable "health_check_grace_period" {
  description = "Grace period before ALB health checks count (blue/green only)."
  type        = number
  default     = 60
}

# ---- mode toggles ----
variable "enable_blue_green" {
  description = "Run as an ALB blue/green service (frontend)."
  type        = bool
  default     = false
}

variable "enable_service_discovery" {
  description = "Run as a Cloud Map rolling service (backend)."
  type        = bool
  default     = false
}

# ---- blue/green inputs (required when enable_blue_green = true) ----
variable "blue_target_group_arn" {
  description = "Active (blue) target group ARN."
  type        = string
  default     = null
}

variable "green_target_group_arn" {
  description = "Alternate (green) target group ARN."
  type        = string
  default     = null
}

variable "production_listener_rule_arn" {
  description = "Production listener rule ARN ECS shifts during blue/green."
  type        = string
  default     = null
}

variable "bluegreen_role_arn" {
  description = "ECS infrastructure role ARN for blue/green LB traffic shifting."
  type        = string
  default     = null
}

variable "bake_time_in_minutes" {
  description = "Minutes to bake the green revision before completing the shift."
  type        = number
  default     = 5
}

# ---- service discovery inputs (required when enable_service_discovery = true) ----
variable "namespace_id" {
  description = "Cloud Map namespace id to register the service in."
  type        = string
  default     = null
}
